## This description is WIP.

### Short description
This is a scheduling app with automatic timezone conversion + time format options, a Heatmap, availability graphs / filters, Events and Discord login Integration - primaraly for multi-national online groups.

**Keep in mind! This is an active student project, all the UI + code comments are in Latvian!**

**Project is Currently set to:**  
**DEVELOPMENT ENVIRONMENT**  
<ins>**(THIS IS NOT A READY TO DEPLOY WEB APPLICATION)**</ins>

### Usage

- Create an account
- Create an avaialability table, choose your timezone / format and then click and drag your available hours in the days you are available (partial availability can be marked by dragging on tiles already set as available)
- Create or join (trough an invite key) an event table
- Choose your availability table and watch the heatmap + graphs update live!

If you are an event owner, you can manage users that have joined your event, create events and create a new invite keys (old one gets destroyed)


### Techstack:
Vue 3, Tailwind, Typescript, Fastify, Postgres, Zod, Redis and other.

***
# Basic startup

## Installation
- Install docker desktop
- Create a folder wherever you would like to store the project
- Open you terminal and travel to the folder you created (you can use the 'cd' command (for example: cd Desktop))
- Use the git clone command to clone the repo onto your system (example: 'git clone https://github.com/TomGHcode/event_scheduler_26' )
- Integrate discord (Follow the "Setting up Discord the integration" guide below)
- Start Docker desktop
- Make sure nothing is running on port 80
- run these commands:
```
docker compose up -d
docker compose up -d --build backend
docker compose up -d --build frontend
docker compose exec backend node dist/migrate.js
```
- Go to http://localhost
- Create an account
- Login
- Done!

### Setting up Discord the integration
- You need to create a new application in the Discord Developer Portal (https://discord.com/developers/applications)
- Open the OAuth2 portion
- Generate a new client secret
- Copy the Client ID and Client Secret
- Go to the section "Reddirects" and add this adress: http://localhost/api/auth/discord/callback
- Go to the project root folder (place where you can see frontend / backend folders)
- create a new file ".env" and add this:

```
DISCORD_CLIENT_ID=tavs_client_id_seit
DISCORD_CLIENT_SECRET=tavs_client_secret_seit
DISCORD_REDIRECT_URI=http://localhost/api/auth/discord/callback
```

***
# Manual tests...
If you are on Windows you can try this...
(might be a bit outdated)

### Account creation trough Windows Powershell

Account creation:
```
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"username":"TestUser", "password":"my_secret_password"}'
```

Test account login:
```
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"username":"TestUser", "password":"my_secret_password"}' -SessionVariable mySession
```

Test table creation:
```
Invoke-RestMethod -Uri "http://localhost:3000/api/events" -Method Post -Headers @{"Content-Type"="application/json"} -WebSession $mySession -Body '{"name":"Summer festival planning", "description":"Searching for the best time!"}
```

Additional:
```
Invoke-RestMethod -Uri "http://localhost:3000/api/events/1/heatmap" -Method Get -WebSession $mySession
```