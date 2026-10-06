const { startTunnel } = require('untun');
const config = require('./config');

async function launchTunnel() {
  console.log(`\n=======================================================`);
  console.log(`🌐 Initializing Cloudflare Public Tunnel for Project Hawa...`);
  console.log(`=======================================================`);

  try {
    const tunnel = await startTunnel({
      url: `http://localhost:${config.PORT}`
    });

    const publicUrl = await tunnel.getURL();
    console.log(`\n🎉 Public Tunnel Active!`);
    console.log(`🔗 Public HTTPS URL: ${publicUrl}`);
    console.log(`⚡ Share this link with your friends to flash their boards:`);
    console.log(`👉 ${publicUrl}/flash.html\n`);

    // Notify local server of updated public URL
    try {
      const response = await fetch(`http://localhost:${config.PORT}/api/tunnel/set-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: publicUrl })
      });
      const data = await response.json();
      console.log(`✅ Hawa Server successfully registered public URL: ${data.publicUrl}\n`);
    } catch (err) {
      console.warn(`[Warning] Could not notify local server directly (is server running?):`, err.message);
    }

    return { tunnel, publicUrl };
  } catch (error) {
    console.error(`❌ Failed to start Cloudflare Tunnel:`, error.message);
    console.log(`💡 You can still run Hawa locally at http://localhost:${config.PORT}`);
  }
}

if (require.main === module) {
  launchTunnel();
}

module.exports = { launchTunnel };
