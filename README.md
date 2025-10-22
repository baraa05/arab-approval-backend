# ARAB Approval Backend (Render)

Endpoints:
- POST /submit        -> {ok:true, order_id}
- GET  /check?id=ORD  -> {status: pending|approved|rejected, order_number?}
- GET  /admin         -> لوحة الموافقات (Basic Auth)

## Deploy on Render
1) Create New -> Web Service -> "Build and deploy from a Git repo" (or use "Deploy from a ZIP" if available).
2) Runtime: Node.
3) Start command: `node server.js`
4) Environment:
   - `ADMIN_USER` = admin
   - `ADMIN_PASS` = StrongPasswordHere
   - (optional) add a Persistent Disk and set `DATA_DIR` to the mount path (e.g., `/data`).
5) After deploy, your base URL is like: https://your-api.onrender.com
6) Use that as API_BASE in the Netlify site.
