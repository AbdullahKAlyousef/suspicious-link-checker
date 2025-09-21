# suspicious-link-checker
A lightweight Chrome/edge extension that flags suspicious links using simple heuristics (HTTPS, IP host, shorteners, typosquatting , punycode).

##how it works?

Right-click any link → **Check link safety** → see a **risk score** (Low/Medium/High) with reasons:
- Not HTTPS
- IP address host
- Unicode/punycode (homograph) in domain
- Known URL shortener
- Many subdomains / unusual ports
- Very long path/query
- Looks like a high-value brand (typosquatting)

## Install (Developer Mode)
1) Download this repo (Code → Download ZIP) and extract.  
2) Chrome/Edge → "chrome://extensions" or  "edge://extensions" → enable Developer mode  
3) Load unpacked → select the folder with manifest.json.  
4) On any page, right-click a link → Check link safety.



##ScreenShots

1. Safe HTTPS link
https://example.com → Low risk (0/100)  
(screenshots/example_https.png)
---
2. Insecure HTTP link
http://example.com → Medium risk (40/100)  
![Medium risk](screenshots/example_http.png)
---
3. IP address instead of domain
http://93.184.216.34 → High risk  (100/100) 
![High risk - IP](screenshots/example_ip.png)
---
 4. Typosquatting domain
http://paypa1.com → High risk (looks like PayPal)  (100/100)
![High risk - Typosquat](screenshots/example_typosquat.png)


## Notes
- All checks run locally in the browser (no data sent anywhere).
- This is an awareness tool, *not* a replacement for enterprise security.

## License
MIT © AbdullahKAlyousef
