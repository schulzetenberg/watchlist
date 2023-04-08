const axios = require('axios');
const http = require('http');
const JustWatch = require('justwatch-api');
const secrets = require('./secrets');
const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');

const clientId = secrets.clientIdTrakt;
const clientSecret = secrets.clientSecretTrakt;
const traktUsername = secrets.usernameTrakt;
const redirectUri = 'http://localhost:8000/callback'; // This needs to match your Trakt app settings
const justwatch = new JustWatch({ locale: 'en_US' });

app.use(cors());

app.get('/watchlist', (req, res) => {
  fs.readFile('watchlistData.json', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading watchlist data:', err);
      res.status(500).send('Error reading watchlist data');
    } else {
      res.json(JSON.parse(data));
    }
	});
});

app.listen(8001, () => {
  console.log('API listening at http://localhost:8001');
});

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/callback')) {
    const authorizationCode = new URL(req.url, 'http://localhost:8000').searchParams.get('code');
    res.write('Authorization code received. You can close this window.');
    res.end();

    // Use the authorization code to request an access token and a refresh token
    axios.post('https://api.trakt.tv/oauth/token', {
      code: authorizationCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })
      .then(async (response) => {
        const { access_token: accessToken } = response.data;
        const watchlistMovies = await getTraktWatchlistMovies(accessToken);
        const watchlistShows = await getTraktWatchlistShows(accessToken);
        checkStreamingAvailabilityAndOutputResults(watchlistMovies, watchlistShows);
        server.close();
      })
      .catch((error) => {
        console.error('Error obtaining access token:', error.message);
        server.close();
      });
  } else {
    res.write('Please visit the Trakt.tv authorization URL to grant access.');
    res.end();
  }
});

server.listen(8000, () => {
  console.log('Server running at http://localhost:8000/');
  console.log('Please visit the following URL to authorize the application:');
  console.log(`https://trakt.tv/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`);
});

async function getTraktWatchlistMovies(accessToken) {
  const response = await axios.get(`https://api.trakt.tv/users/${traktUsername}/watchlist/movies`, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

async function getTraktWatchlistShows(accessToken) {
  const response = await axios.get(`https://api.trakt.tv/users/${traktUsername}/watchlist/shows`, {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

async function checkStreamingAvailability(title, type) {
  const searchResults = await justwatch.search({ query: title, content_types: [type] });

  return searchResults.items.reduce((results, item) => {
    if (item.title === title) {
      item.offers?.forEach((offer) => {
        if (offer.provider_id === 8 || offer.provider_id === 9) {
          results.providers.add(offer.provider_id);
        }
      });

			results.image = item.poster ? `https://images.justwatch.com${item.poster.replace('{profile}', 's592')}` : '';

			const urlType = type === 'movie' ? 'movie' : 'tv-show';
			const titleNoApostraphe = title.replace(/[']/g, '');
			const titleCleaned = titleNoApostraphe.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
			results.url = `https://www.justwatch.com/us/${urlType}/${titleCleaned}`;
    }
    return results;
  }, { providers: new Set(), image: null, url: null });
}

async function checkStreamingAvailabilityAndOutputResults(watchlistMovies, watchlistShows) {
  const netflixMovies = [];
  const netflixShows = [];
  const primeVideoMovies = [];
  const primeVideoShows = [];

  await Promise.all(watchlistMovies.map(async (movie) => {
    try {
      const availableProviders = await checkStreamingAvailability(movie.movie.title, 'movie');
      if (availableProviders.providers.has(8)) {
				netflixMovies.push({ title: movie.movie.title, image: availableProviders.image, url: availableProviders.url });
      } else if (availableProviders.providers.has(9)) {
				primeVideoMovies.push({ title: movie.movie.title, image: availableProviders.image, url: availableProviders.url });
      }
    } catch (error) {
      console.error(`Error checking streaming availability for movie "${movie.movie.title}":`, error.message);
    }
  }));

  await Promise.all(watchlistShows.map(async (show) => {
    try {
      const availableProviders = await checkStreamingAvailability(show.show.title, 'show');
      if (availableProviders.providers.has(8)) {
				netflixShows.push({ title: show.show.title, image: availableProviders.image, url: availableProviders.url });
      } else if (availableProviders.providers.has(9)) {
				primeVideoShows.push({ title: show.show.title, image: availableProviders.image, url: availableProviders.url });
      }
    } catch (error) {
      console.error(`Error checking streaming availability for show "${show.show.title}":`, error.message);
    }
  }));

  const watchlistData = {
    netflixMovies: netflixMovies.map(({ title, image, url }) => ({ title, image, url })),
    netflixShows: netflixShows.map(({ title, image, url }) => ({ title, image, url })),
    primeVideoMovies: primeVideoMovies.map(({ title, image, url }) => ({ title, image, url })),
    primeVideoShows: primeVideoShows.map(({ title, image, url }) => ({ title, image, url })),
  };

	fs.writeFile('watchlistData.json', JSON.stringify(watchlistData, null, 2), (err) => {
    if (err) {
      console.error('Error saving watchlist data:', err);
    } else {
      console.log('** Watchlist data saved to watchlistData.json **');
    }
  });
}