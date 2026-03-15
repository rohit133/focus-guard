// FocusGuard – Social Media Blocker Content Script
// This runs before page loads on blocked sites

(async function () {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_FOCUS_STATE" });
    if (!response?.active) return;

    // Replace page content immediately
    document.documentElement.innerHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Blocked by FocusGuard</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Crimson+Pro:ital,wght@0,400;1,400&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          background: #0a0000;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Roboto', 'sans-serif';
          overflow: hidden;
        }
        
        .bg-glow {
          position: fixed;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(139,0,0,0.15) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        
        .card {
          text-align: center;
          padding: 60px 48px;
          border: 1px solid rgba(139,0,0,0.4);
          border-radius: 4px;
          background: rgba(20,0,0,0.8);
          backdrop-filter: blur(20px);
          max-width: 480px;
          width: 90%;
          position: relative;
        }
        
        .card::before {
          content: '';
          position: absolute;
          top: -1px; left: 20%; right: 20%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #8B0000, #FF4444, #8B0000, transparent);
        }
        
        .icon {
          font-size: 48px;
          margin-bottom: 24px;
          display: block;
          filter: grayscale(0.3);
        }
        
        h1 {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-weight: 900;
          color: #FF4444;
          letter-spacing: -0.5px;
          margin-bottom: 12px;
          line-height: 1.1;
        }
        
        .subtitle {
          color: rgba(255,150,150,0.7);
          font-size: 18px;
          font-style: italic;
          margin-bottom: 32px;
          line-height: 1.6;
        }
        
        .domain {
          display: inline-block;
          background: rgba(139,0,0,0.2);
          border: 1px solid rgba(139,0,0,0.5);
          color: #FF6B6B;
          padding: 6px 16px;
          border-radius: 2px;
          font-family: monospace;
          font-size: 14px;
          margin-bottom: 32px;
          letter-spacing: 1px;
        }
        
        .time-info {
          color: rgba(255,120,120,0.5);
          font-size: 14px;
          line-height: 1.8;
        }
        
        .time-info strong {
          color: rgba(255,150,150,0.8);
        }
        
        .divider {
          width: 40px;
          height: 1px;
          background: rgba(139,0,0,0.5);
          margin: 24px auto;
        }
        
        .go-back {
          margin-top: 28px;
          display: inline-block;
          color: rgba(255,100,100,0.5);
          font-size: 13px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .go-back:hover { color: rgba(255,100,100,0.9); }
      </style>
    </head>
    <body>
      <div class="bg-glow"></div>
      <div class="card">
        <span class="icon">🔒</span>
        <h1>Stay Focused.</h1>
        <p class="subtitle">This site is blocked during your<br>deep work hours.</p>
        <div class="domain">${location.hostname}</div>
        <div class="divider"></div>
        <div class="time-info">
          <strong>Work Hours:</strong> Mon–Sat, 9:00 AM – 6:00 PM<br>
          Come back when your work is done.<br>
          You've got this. 💪
        </div>
        <div class="go-back" id="fg-go-back">← Go back</div>
      </div>
    </body>
    </html>
  `;

    // Add event listener directly (no inline script)
    const backBtn = document.getElementById('fg-go-back');
    if (backBtn) {
      backBtn.onclick = () => {
        if (history.length > 1) {
          history.back();
        } else {
          location.href = "https://www.google.com";
        }
      };
    }
  } catch (e) {
    console.error("FocusGuard: Failed to get focus state:", e);
    // If we can't communicate with background, don't block
  }
})();
