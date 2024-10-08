# Verum Wallet

![Download Count](https://img.shields.io/github/downloads/VerumProject/Verum-GUI-Wallet/total.svg)
![Open Issue Count](https://img.shields.io/github/issues/VerumProject/Verum-GUI-Wallet)
![License](https://img.shields.io/github/license/VerumProject/Verum-GUI-Wallet)
![Version](https://img.shields.io/github/v/release/VerumProject/Verum-GUI-Wallet)

### Master Build Status

![Master Build Status](https://github.com/VerumProject/Verum-GUI-Wallet/workflows/Build/badge.svg?branch=master)

### Development Build Status

![Development Build Status](https://github.com/VerumProject/Verum-GUI-Wallet/workflows/Build/badge.svg?branch=development)

Verum Wallet is a wallet that uses

- [Electron](http://electron.atom.io/)
- [React](https://facebook.github.io/react/)
- [Turtlecoin-wallet-backend-JS](https://github.com/VerumProject/turtlecoin-wallet-backend-js)
- [Redux](https://github.com/reactjs/redux)
- [React Router](https://github.com/reactjs/react-router)
- [Webpack](http://webpack.github.io/docs/)
- [React Hot Loader](https://github.com/gaearon/react-hot-loader)

All of the code is released under the GPLv3 license. The icons in the ./resources and ./app/images folders, however, are not released under this license, rather they are maintained to be intellectual property of Verum256, and may not be used to represent the brand or identity of any other piece of software or group. See the included license file in ./resources/LICENSE and ./app/images/LICENSE for more details.

## Development Setup (All Platforms)

### Dependencies

#### You will need the following dependencies installed before you can proceed to the "Setup" step:
- Node.JS (v14.x) https://nodejs.org/
- Yarn https://yarnpkg.com/en/
- Git https://git-scm.com/downloads

Tip: If you already have a different version of Node.JS installed besides 14.x, try using [Node Version Manager](https://github.com/nvm-sh/nvm#install--update-script).

#### Setup

First, clone the repo via git:

```bash
git clone https://github.com/VerumProject/Verum-GUI-Wallet.git
```

And then install the dependencies with yarn.

```bash
$ cd Verum-GUI-Wallet
$ yarn
```

Run the wallet.

```bash
$ yarn start
```

### Starting Development

Start the app in the `dev` environment. This starts the renderer process in [**hot-module-replacement**](https://webpack.js.org/guides/hmr-react/) mode and starts a webpack dev server that sends hot updates to the renderer process:

```bash
$ yarn dev
```

### Packaging

To package apps for the local platform:

```bash
$ yarn package
```

## License

© [ExtraHash](https://github.com/ExtraHash)  
© [Verum256](https://github.com/Verum256)  
See included License file for more details.
