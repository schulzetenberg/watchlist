import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('http://localhost:8001/watchlist');
      const json = await response.json();
      setData(json);
    };

    fetchData();
  }, []);

  if (!data) {
    return <div>Loading...</div>;
  }

  const { netflixMovies, netflixShows, primeVideoMovies, primeVideoShows } = data;

  return (
    <div className="App">
      <h1>What To Watch</h1>
      <div className="provider-container">
				<h2>Movies available on Netflix</h2>
				<ul>
					{netflixMovies.map(({ title, image, url }) => (
						<li key={title}>
							<img src={image} alt={title} className="title-image" />
							<a href={url} target="_blank" rel="noopener noreferrer">{title}</a>
						</li>
					))}
				</ul>

				<h2>Shows available on Netflix</h2>
				<ul>
					{netflixShows.map(({ title, image, url }) => (
						<li key={title}>
							<img src={image} alt={title} className="title-image" />
							<a href={url} target="_blank" rel="noopener noreferrer">{title}</a>
						</li>
					))}
				</ul>
				<h2>Movies available on Prime Video</h2>
				<ul>
					{primeVideoMovies.map(({ title, image, url }) => (
						<li key={title}>
							<img src={image} alt={title} className="title-image" />
							<a href={url} target="_blank" rel="noopener noreferrer">{title}</a>
						</li>
					))}
				</ul>
				<h2>Shows available on Prime Video</h2>
				<ul>
					{primeVideoShows.map(({ title, image, url }) => (
						<li key={title}>
							<img src={image} alt={title} className="title-image" />
							<a href={url} target="_blank" rel="noopener noreferrer">{title}</a>
						</li>
					))}
				</ul>
      </div>
    </div>
  );
}

export default App;
