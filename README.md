yarn build
yarn dlx serve -s dist -l 8443
tailscale funnel 8443
