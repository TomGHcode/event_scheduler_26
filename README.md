## This description is WIP.

### Short description
This is a scheduling app with automatic timezone conversion + time format options, a Heatmap, availability graphs / filters, and Events - primaraly for multi-national online groups.

<ins>**Keep in mind! This is a student project and all the UI + code comments are in Latvian!**</ins>

### Usage

- Create an account
- Create an avaialability table, choose your timezone / format and then click and drag your available hours in the days you are available (partial availability can be marked by dragging on tiles already set as available)
- Create or join (trough an invite key) an event table
- Choose your availability table and watch the heatmap + graphs update live!

If you are an event owner, you can manage users that have joined your event, create events and create a new invite keys (old one gets destroyed)


### Techstack:
Vue 3, Tailwind, Typescript, Fastify, Postgres, Zod, Redis and other.


# Basic startup
-----------------------

## Installation
- Install docker desktop
- Create a folder wherever you would like to store the project
- Open you terminal and travel to the folder you created (you can use the 'cd' command (for example: cd Desktop))
- Use the git clone command to clone the repo onto your system (example: 'git clone https://github.com/TomGHcode/event_scheduler_26' )
- Start Docker desktop
- Make sure nothing is running on port 80
- run these commands:
	- 'docker compose up -d'
	- 'docker compose up -d --build backend'
	- 'docker compose up -d --build frontend'
	- 'docker compose exec backend node dist/migrate.js'
- Go to http://localhost
- Create an account
- Login
- Done!

***

## Manual tests...
If you are on Windows you can try this...

### Account creation trough Windows Powershell
--------------------------------------------

Account creation:
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"username":"TestUser", "password":"my_secret_password"}'

Test account login:
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"username":"TestUser", "password":"my_secret_password"}' -SessionVariable mySession

Test table creation:
Invoke-RestMethod -Uri "http://localhost:3000/api/events" -Method Post -Headers @{"Content-Type"="application/json"} -WebSession $mySession -Body '{"name":"Summer festival planning", "description":"Searching for the best time!"}

Additional:
Invoke-RestMethod -Uri "http://localhost:3000/api/events/1/heatmap" -Method Get -WebSession $mySession
