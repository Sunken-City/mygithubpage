document.addEventListener('DOMContentLoaded', () => {
    const fetchPlayerCount = () => {
        fetch('https://games.roblox.com/v1/games?universeIds=1511649232,3937161490,4267929747,4981761600,5755992087')
          .then(response => response.json())
          .then(data => {
            const totalPlaying = data.data.reduce((sum, game) => sum + game.playing, 0);
            document.getElementById('total-players').textContent = totalPlaying;
          })
          .catch(error => {
            console.error('Error:', error);
            document.getElementById('total-players').textContent = 'Error loading data';
          });
    };

    // Initial fetch when the page loads
    fetchPlayerCount();

    // Refresh the count every 30 seconds (30,000 milliseconds)
    setInterval(fetchPlayerCount, 30000);
});

