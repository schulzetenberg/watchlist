const axios = require('axios');
const http = require('http');
const JustWatch = require('justwatch-api');
const secrets = require('./secrets');

const clientId = secrets.clientIdTrakt;
const clientSecret = secrets.clientSecretTrakt;
const traktUsername = secrets.usernameTrakt;
const redirectUri = 'http://localhost:8000/callback'; // This needs to match your Trakt app settings
const justwatch = new JustWatch({ locale: 'en_US' });

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

  return searchResults.items.reduce((providers, item) => {
    if (item.title === title) {
      item.offers?.forEach((offer) => {
        if (offer.provider_id === 8 || offer.provider_id === 9) {
          providers.add(offer.provider_id);
        }
      });
    }
    return providers;
  }, new Set());
}

async function checkStreamingAvailabilityAndOutputResults(watchlistMovies, watchlistShows) {
  const netflixMovies = [];
  const netflixShows = [];
  const primeVideoMovies = [];
  const primeVideoShows = [];

  await Promise.all(watchlistMovies.map(async (movie) => {
    try {
      const availableProviders = await checkStreamingAvailability(movie.movie.title, 'movie');
      if (availableProviders.has(8)) {
        netflixMovies.push(movie.movie.title);
      } else if (availableProviders.has(9)) {
        primeVideoMovies.push(movie.movie.title);
      }
    } catch (error) {
      console.error(`Error checking streaming availability for movie "${movie.movie.title}":`, error.message);
    }
  }));

  await Promise.all(watchlistShows.map(async (show) => {
    try {
      const availableProviders = await checkStreamingAvailability(show.show.title, 'show');
      if (availableProviders.has(8)) {
        netflixShows.push(show.show.title);
      } else if (availableProviders.has(9)) {
        primeVideoShows.push(show.show.title);
      }
    } catch (error) {
      console.error(`Error checking streaming availability for show "${show.show.title}":`, error.message);
    }
  }));

  console.log('Movies available on Netflix:');
  console.log(netflixMovies);

  console.log('Shows available on Netflix:');
  console.log(netflixShows);

  console.log('Movies available on Prime Video:');
  console.log(primeVideoMovies);

  console.log('Shows available on Prime Video:');
  console.log(primeVideoShows);
}