// Copyright (C) 2019 ExtraHash
// Copyright (C) 2024, Verum256
//
// Please see the included LICENSE file for more information.
import {
  Daemon,
  WalletBackend,
  LogLevel,
  prettyPrintAmount
} from 'turtlecoin-wallet-backend';
import log from 'electron-log';
import { ipcRenderer } from 'electron';
import { createObjectCsvWriter } from 'csv-writer';
import { atomicToHuman, convertTimestamp } from '../mainWindow/utils/utils';
import Config from '../Config';

export default class Backend {
  notifications: boolean;

  daemon: Daemon;

  daemonHost: string;

  daemonPort: number;

  walletFile: string;

  walletPassword: string = '';

  wallet: any;

  walletActive: boolean = false;

  lastTxAmountRequested: number = 50;

  blocksSinceLastSave: number = 0;

  transactionCount: number = 0;

  saveInterval: IntervalID = setInterval(
    this.saveWallet.bind(this),
    1000 * 60 * 5,
    false
  );

  constructor(config: any): Backend {
    this.notifications = config.notifications;
    this.daemonHost = config.daemonHost;
    this.daemonPort = config.daemonPort;
    this.walletFile = config.walletFile;
    this.logLevel = config.logLevel;
    this.daemon = new Daemon(this.daemonHost, this.daemonPort, false);

    if (config.scanCoinbaseTransactions) {
      Config.scanCoinbaseTransactions = config.scanCoinbaseTransactions;
    }
  }

  setNotifications(status: boolean) {
    this.notifications = status;
  }

  setDaemon(daemon: Daemon): void {
    this.daemon = daemon;
  }

  getDaemon(): Daemon {
    return this.daemon;
  }

  setWalletPassword(password: string): void {
    this.walletPassword = password;
  }

  getWalletPassword(): string {
    return this.walletPassword;
  }

  getNodeFee(): void {
    ipcRenderer.send('fromBackend', 'nodeFee', this.wallet.getNodeFee()[1]);
  }

  getWalletActive(): boolean {
    return this.walletActive;
  }

  setWalletActive(state: boolean): void {
    this.walletActive = state;
  }

  getLastTxAmountRequested(): boolean {
    return this.lastTxAmountRequested;
  }

  setLastTxAmountRequested(amount: number): void {
    this.lastTxAmountRequested = amount;
  }

  evaluateLogLevel(logLevel: string): LogLevel {
    switch (logLevel) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARNING':
        return LogLevel.WARNING;
      case 'TRACE':
        return LogLevel.TRACE;
      default:
        return LogLevel.DISABLED;
    }
  }

  exportToCSV(savePath: string) {
    const rawTransactions = this.getFormattedTransactions(
      undefined,
      undefined,
      false
    );
    const csvWriter = createObjectCsvWriter({
      path: savePath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'blockHeight', title: 'Block Height' },
        { id: 'transactionHash', title: 'Transaction Hash' },
        { id: 'pid', title: 'Payment ID' },
        { id: 'amount', title: 'Amount' },
        { id: 'bal', title: 'balance' }
      ]
    });
    const csvData = rawTransactions.map(item => {
      return {
        date: convertTimestamp(item[0]),
        blockHeight: item[4],
        transactionHash: item[1],
        pid: item[5],
        amount: atomicToHuman(item[2], true),
        bal: atomicToHuman(item[3], true)
      };
    });
    csvWriter.writeRecords(csvData);
  }

  setScanCoinbaseTransactions(value: boolean) {
    Config.scanCoinbaseTransactions = value;
    this.wallet.scanCoinbaseTransactions(value);
  }

  async sendTransaction(hash: string): void {
    const result = await this.wallet.sendPreparedTransaction(hash);

    if (result.success) {
      console.log(
        `Sent transaction, hash ${
          result.transactionHash
        }, fee ${prettyPrintAmount(result.fee, Config)}`
      );
      const response = {
        status: 'SUCCESS',
        hash: result.transactionHash,
        error: undefined
      };
      ipcRenderer.send('fromBackend', 'sendTransactionResponse', response);
      this.getTransactions(this.getLastTxAmountRequested() + 1);
    } else {
      console.log(`Failed to send transaction: ${result.error.toString()}`);
      result.error.errorString = result.error.toString();
      const response = {
        status: 'FAILURE',
        hash: undefined,
        error: result.error
      };
      ipcRenderer.send('fromBackend', 'sendTransactionResponse', response);
    }
  }

  async prepareTransaction(transaction): void {
    const networkHeight = this.daemon.getNetworkBlockCount();
    const { address, amount, paymentID, sendAll } = transaction;
    const mixin =
      sendAll || amount >= 100000000
        ? Config.mixinLimits.getDefaultMixinByHeight(networkHeight)
        : undefined;
    const destinations = [[address, sendAll ? 100000 : amount]];

    const result = await this.wallet.sendTransactionAdvanced(
      destinations, // destinations
      mixin, // mixin
      undefined, // fee
      paymentID, // paymentID
      undefined, // subwalletsToTakeFrom
      undefined, // changeAddress
      false, // relayToNetwork
      sendAll // sendAll
    );

    log.info(result);

    if (result.success) {
      const [unlockedBalance, lockedBalance] = this.wallet.getBalance();
      console.log(unlockedBalance, lockedBalance);
      const balance = parseInt(unlockedBalance + lockedBalance, 10);
      const response = {
        status: 'SUCCESS',
        hash: result.transactionHash,
        address,
        paymentID,
        amount: sendAll ? balance : amount,
        fee: result.fee,
        nodeFee: this.wallet.getNodeFee()[1],
        error: undefined
      };
      ipcRenderer.send('fromBackend', 'prepareTransactionResponse', response);
      this.getTransactions(this.getLastTxAmountRequested() + 1);
    } else {
      console.log(`Failed to send transaction: ${result.error.toString()}`);
      result.error.errorString = result.error.toString();
      const response = {
        status: 'FAILURE',
        hash: undefined,
        address,
        paymentID,
        amount,
        fee: result.fee,
        nodeFee: this.wallet.getNodeFee()[1],
        error: result.error
      };
      ipcRenderer.send('fromBackend', 'prepareTransactionResponse', response);
    }
  }

  verifyPassword(password: string): void {
    ipcRenderer.send(
      'fromBackend',
      'authenticationStatus',
      password === this.walletPassword
    );
  }

  getPrivateView(): void {
    const [
      privateSpendKey,
      privateViewKey
    ] = this.wallet.getPrimaryAddressPrivateKeys();

    ipcRenderer.send(
      'fromBackend',
      'getPrivateView',
      privateViewKey
    );
  }

  changePassword(passwords: any): void {
    const { oldPassword, newPassword } = passwords;
    let response;
    if (this.getWalletPassword() !== oldPassword) {
      response = { status: 'FAILURE', error: 'AUTHERROR' };
    } else {
      this.setWalletPassword(newPassword);
      const saved = this.saveWallet(false);
      if (saved) {
        response = { status: 'SUCCESS', error: undefined };
      } else {
        response = { status: 'FAILURE', error: 'SAVEERROR' };
      }
    }
    ipcRenderer.send('fromBackend', 'passwordChangeResponse', response);
  }

  async rescanWallet(height: number) {
    await this.wallet.reset(height);
    this.saveWallet(false);
    ipcRenderer.send('fromBackend', 'rescanResponse', height);
  }

  getFormattedTransactions(
    startIndex?: number,
    numTransactions?: number,
    includeFusions?: boolean
  ): any[] {
    const rawTransactions = this.wallet.getTransactions(
      startIndex,
      numTransactions,
      includeFusions || false
    );
    const [unlockedBalance, lockedBalance] = this.wallet.getBalance();
    let balance = parseInt(unlockedBalance + lockedBalance, 10);
    const transactions = [];

    for (const [index, tx] of rawTransactions.entries()) {
      transactions.push([
        tx.timestamp,
        tx.hash,
        tx.totalAmount(),
        balance,
        tx.blockHeight,
        tx.paymentID,
        index,
        tx.fee,
        tx.unlockTime
      ]);
      balance -= parseInt(tx.totalAmount(), 10);
    }
    return transactions;
  }

  stop(isShuttingDown: boolean) {
    if (this.wallet) {
      this.saveWallet(false);
      clearInterval(this.saveInterval);
      this.wallet.stop();
    }
    if (isShuttingDown) {
      ipcRenderer.send('backendStopped');
    }
  }

  getTransactions(displayCount: number): void {
    this.setLastTxAmountRequested(displayCount);
    ipcRenderer.send(
      'fromBackend',
      'transactionList',
      this.getFormattedTransactions(0, displayCount, false)
    );
  }

  getTransactionCount(): void {
    ipcRenderer.send('fromBackend', 'transactionCount', this.transactionCount);
  }

  getBalance(): void {
    ipcRenderer.send('fromBackend', 'balance', this.wallet.getBalance());
  }

  saveWallet(notify: boolean, path?: string): boolean {
    if (!this.getWalletActive()) {
      return;
    }
    const status = this.wallet.saveWalletToFile(
      path || this.walletFile,
      this.walletPassword
    );

    if (notify) {
      ipcRenderer.send('fromBackend', 'saveWalletResponse', status);
    }
    return status;
  }

  transactionSearch(query: string) {
    const transactions = this.wallet.getTransactions();
    const possibleTransactionValues = ['blockHeight', 'hash', 'paymentID'];
    const transactionResults = possibleTransactionValues.map(value => {
      return this.search(query, transactions, value);
    });
    let sanitizedResults = [];
    /* the search function returns a separate array of results for each
    value searched, we need to concat them together with spread */
    for (let i = 0; i < transactionResults.length; i++) {
      sanitizedResults = [...transactionResults[i], ...sanitizedResults];
    }
    ipcRenderer.send(
      'fromBackend',
      'transactionSearchResponse',
      sanitizedResults
    );
  }

  search(searchedValue: any, arrayToSearch: any[], objectPropertyName: string) {
    const resultsToReturn = [];
    for (let i = 0; i < arrayToSearch.length; i++) {
      // will resolve to true if the selected value contains the substring, case insensitive
      if (
        String(arrayToSearch[i][objectPropertyName])
          .toUpperCase()
          .includes(searchedValue.toUpperCase())
      ) {
        /* we have to disable this because the function gets lost
        when we send the object over ipc */
        // eslint-disable-next-line no-param-reassign
        arrayToSearch[i].totalTxAmount = arrayToSearch[i].totalAmount();
        resultsToReturn.push(arrayToSearch[i]);
      }
    }
    return resultsToReturn;
  }

  async changeNode(nodeInfo: any): void {
    const { host, port } = nodeInfo;
    this.setDaemon(new Daemon(host, port, false));
    await this.wallet.swapNode(this.daemon);
    this.getConnectionInfo();
    this.getNodeFee();
  }

  getConnectionInfo(): void {
    ipcRenderer.send(
      'fromBackend',
      'daemonConnectionInfo',
      this.wallet.getDaemonConnectionInfo()
    );
  }

  setLogLevel(logLevel: string): void {
    this.logLevel = logLevel;
    this.wallet.setLogLevel(this.evaluateLogLevel(this.logLevel));
  }

  async walletInit(wallet: any): Promise<void> {
    console.log('walletInit');
    this.wallet = wallet;
    this.setLogLevel(this.logLevel);
    this.wallet.on(
      'heightchange',
      (walletBlockCount, localDaemonBlockCount, networkBlockCount) => {
        ipcRenderer.send('fromBackend', 'syncStatus', [
          walletBlockCount,
          localDaemonBlockCount,
          networkBlockCount
        ]);
      }
    );
    this.wallet.on('transaction', () => {
      this.getTransactionCount();
      this.getTransactions(this.getLastTxAmountRequested() + 1);
      this.getBalance();
    });

    this.wallet.on('incomingtx', transaction => {
      if (this.notifications) {
        // eslint-disable-next-line no-new
        new window.Notification('Transaction Received!', {
          body: `You've just received ${atomicToHuman(
            transaction.totalAmount(),
            true
          )} ${Config.ticker}.`
        });
      }
    });
    this.setWalletActive(true);
    ipcRenderer.send('fromBackend', 'syncStatus', this.wallet.getSyncStatus());
    ipcRenderer.send(
      'fromBackend',
      'primaryAddress',
      this.wallet.getPrimaryAddress()
    );
    ipcRenderer.send(
      'fromBackend',
      'transactionList',
      this.getFormattedTransactions(0, 50, false)
    );
    this.getTransactionCount();

    console.log('this.wallet.getBalance()', this.wallet.getBalance());

    ipcRenderer.send('fromBackend', 'balance', this.wallet.getBalance());
    ipcRenderer.send('fromBackend', 'walletActiveStatus', true);
    ipcRenderer.send('fromBackend', 'authenticationStatus', true);
    await this.wallet.start();
    ipcRenderer.send(
      'fromBackend',
      'daemonConnectionInfo',
      this.wallet.getDaemonConnectionInfo()
    );
    this.getNodeFee();
  }

  getSecret(): string {
    const publicAddress = this.wallet.getPrimaryAddress();
    const [
      privateSpendKey,
      privateViewKey
    ] = this.wallet.getPrimaryAddressPrivateKeys();
    // eslint-disable-next-line prefer-const
    let [mnemonicSeed, err] = this.wallet.getMnemonicSeed();
    if (err) {
      if (err.errorCode === 41) {
        mnemonicSeed = '';
      } else {
        throw err;
      }
    }

    const secret =
      // eslint-disable-next-line prefer-template
      publicAddress +
      `\n\nPrivate Spend Key:\n\n` +
      privateSpendKey +
      `\n\nPrivate View Key:\n\n` +
      privateViewKey +
      (mnemonicSeed !== '' ? `\n\nMnemonic Seed:\n\n` : '') +
      mnemonicSeed +
      `\n\nPlease save these keys safely and securely. \nIf you lose your keys, you will not be able to recover your funds.`;

    return secret;
  }

  startWallet(password: string): void {
    this.walletPassword = password;
    const [openWallet, error] = WalletBackend.openWalletFromFile(
      this.daemon,
      this.walletFile,
      this.walletPassword,
      Config
    );
    if (!error) {
      this.walletInit(openWallet);
    } else {
      ipcRenderer.send('fromBackend', 'authenticationStatus', false);
    }
  }
}
