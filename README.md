# Tailscale Shape Generator

You can access this tool now! Head over to https://shapes.ide-rigel.ts.net and start creating.

## Installing and running locally
To run this app locally follow these quick steps on a Mac or Linux device.
These steps assume you have already installed a few software tools:
- a package manager like yarn
- the Github CLI
- Tailscale

### 1. Open Terminal or your Linux shell of choice
### 2. Navigate to the folder where you want to install the app
In the terminal window type 'ls' to list the folders in your current directory.
```
danny@becher ~ % ls
Applications
Desktop
Developer
Documents
Downloads
Library
Movies
Music
Pictures
Public
```
Use `cd` followed by the folder name to move into that folder. 
```
danny@becher ~ % cd Developer
danny@becher Developer % 
```
### 3. If you have the Github CLI installed you can copy the clone script from the main page of this repo
```
gh repo clone dannypagano/ts-shape-gen
```
Paste it into terminal and hit enter.
Alternatively, you can download the repo as a .zip file and unpack it into your install location of choice.

### 4. Install dependencies and build the app
Hop into your new project directory with
```
cd ts-shape-gen
```
Using your package manager of choice (I like yarn) you need to install the software dependencies for the app.
```
yarn install
```

### 5. Serve the app to the internet
Spin up a local server that runs the app by running
```
yarn vite serve
```
Vite is a tool for developing, building and serving web projects.

### 6. Start using the app
Open a web browser and paste in
```
http://localhost:8443/
```

### [Optional] Make the app available over Tailscale Funnel
In a new terminal window, navigate back to your project's install folder.
Tell Tailscale to make your app accessible via Funnel by running
```
tailscale funnel 8443
```

### 7. Start generating shapes!

