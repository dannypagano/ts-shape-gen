# Tailscale Shape Generator
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
Using your package manager of choice, I like yarn, you need to build the app.
This essentially packages it up for use, and gets it ready to publish.
```
yarn build
```

### 5. Serve the app to the internet
Spin up a local server that runs the app by running
```
yarn serve
```

### [Optional] Tell yarn to serve the app over a specific port
You can pass a couple arguments when you run `yarn serve` that tells
yarn to make the app available on a specific port.
```
yarn serve -s dist -l 8443
```
This example serves the app over the same port used by Tailscale Funnel,
so you can share it with the rest of the internet, instead of just inside your tailnet.

### 6. Start using the app
Open a web browser and paste in the IP address and port that appeared when you ran `yarn serve`

### [Optional] Make the app available over Tailscale Funnel
In a new terminal window, navigate back to your project's install folder.
Tell Tailscale to make your app accessible via Funnel by running
```
tailscale funnel 8443
```

### 7. Start generating shapes!

