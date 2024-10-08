// Copyright (C) 2019 ExtraHash
// Copyright (C) 2024, Verum256
//
// Please see the included LICENSE file for more information.

/* eslint-disable jsx-a11y/label-has-associated-control */

import crypto from 'crypto';
import { ipcRenderer } from 'electron';
import isDev from 'electron-is-dev';
import log from 'electron-log';
import React, { Component } from 'react';
import Creatable from 'react-select/creatable';
import ReactTooltip from 'react-tooltip';
import {
  session,
  eventEmitter,
  i18n,
  config,
  loginCounter,
  addressList
} from '../index';
import NavBar from './NavBar';
import BottomBar from './BottomBar';
import Redirector from './Redirector';
import { uiType, atomicToHuman, search } from '../utils/utils';
import donateInfo from '../constants/donateInfo.json';
import Config from '../../Config';

type Props = {
  uriAddress?: string,
  uriPaymentID?: string
};

type State = {
  unlockedBalance: number,
  enteredAmount: string,
  totalAmount: string,
  paymentID: string,
  darkMode: boolean,
  transactionInProgress: boolean,
  displayCurrency: string,
  fiatPrice: number,
  fiatSymbol: string,
  symbolLocation: string,
  sendToAddress: string,
  pageAnimationIn: string,
  selectedContact: any,
  menuIsOpen: boolean,
  nodeFee: number,
  sendAll: boolean
};

const customStyles = {
  control: base => ({
    ...base,
    height: 54,
    minHeight: 54,
    fontSize: '1.5rem'
  }),
  placeholder: base => ({
    ...base,
    color: 'hsl(0, 0%, 71%)',
    fontWeight: 'normal'
  }),
  menuList: base => ({
    ...base,
    color: 'hsl(0, 0%, 21%)',
    fontWeight: 'normal'
  }),
  singleValue: base => ({
    ...base,
    fontWeight: 'normal'
  })
};

export default class Send extends Component<Props, State> {
  props: Props;

  state: State;

  autoCompleteContacts: any[];

  static defaultProps: any;

  constructor(props?: Props) {
    super(props);
    this.state = {
      unlockedBalance: session.getUnlockedBalance(),
      enteredAmount: '',
      sendToAddress: props.uriAddress || '',
      paymentID: props.uriPaymentID || '',
      darkMode: config.darkMode,
      transactionInProgress: false,
      displayCurrency: config.displayCurrency,
      fiatPrice: session.fiatPrice,
      fiatSymbol: config.fiatSymbol,
      symbolLocation: config.symbolLocation,
      pageAnimationIn: loginCounter.getAnimation('/send'),
      selectedContact: null,
      menuIsOpen: false,
      nodeFee: session.getNodeFee(),
      sendAll: false
    };

    this.generatePaymentID = this.generatePaymentID.bind(this);
    this.resetForm = this.resetForm.bind(this);
    this.handleTransactionInProgress = this.handleTransactionInProgress.bind(
      this
    );
    this.handleTransactionCancel = this.handleTransactionCancel.bind(this);
    this.handleAmountChange = this.handleAmountChange.bind(this);
    this.sendAll = this.sendAll.bind(this);
    this.handlePaymentIDChange = this.handlePaymentIDChange.bind(this);
    this.updateFiatPrice = this.updateFiatPrice.bind(this);
    this.handleSendToAddressChange = this.handleSendToAddressChange.bind(this);
    this.prepareTransaction = this.prepareTransaction.bind(this);
    this.checkInputLength = this.checkInputLength.bind(this);
    this.handleDonate = this.handleDonate.bind(this);
    this.handleVerminting = this.handleVerminting.bind(this);
    this.handleNewNodeFee = this.handleNewNodeFee.bind(this);
    this.autoCompleteContacts = [
      ...addressList.map(contact => {
        return { label: contact.name, value: contact.address };
      })
    ];
    this.handleBackendMessages = this.handleBackendMessages.bind(this);
    this.devContact = {
      label: donateInfo.name,
      value: donateInfo.address
    };
  }

  componentDidMount() {
    eventEmitter.on('transactionInProgress', this.handleTransactionInProgress);
    eventEmitter.on('transactionCancel', this.handleTransactionCancel);
    eventEmitter.on('gotFiatPrice', this.updateFiatPrice);
    eventEmitter.on('gotNodeFee', this.handleNewNodeFee);
    eventEmitter.on('modifyCurrency', this.modifyCurrency);
    ipcRenderer.on('handleDonate', this.handleDonate);
    ipcRenderer.on('handleVerminting', this.handleVerminting);
    ipcRenderer.on('fromBackend', this.handleBackendMessages);
    // eslint-disable-next-line react/destructuring-assignment
    if (this.props && this.props.uriAddress) {
      const { uriAddress } = this.props;

      console.log(uriAddress);

      const selectedContact = search(
        uriAddress,
        [this.devContact, ...this.autoCompleteContacts],
        'value'
      );

      if(uriAddress.startsWith("verminting")) {
        this.setState({
          selectedContact: { label: "Verminting", value: uriAddress.split(":")[1] },
          sendToAddress: uriAddress.split(":")[1],
          enteredAmount: uriAddress.split(":")[2]
        });
        console.log("kanker", uriAddress.split(":")[2])
      } else {
        this.setState({
          selectedContact
        });
      }
    }
  }

  componentWillUnmount() {
    eventEmitter.off('transactionInProgress', this.handleTransactionInProgress);
    eventEmitter.off('transactionCancel', this.handleTransactionCancel);
    eventEmitter.off('gotFiatPrice', this.updateFiatPrice);
    eventEmitter.off('gotNodeFee', this.handleNewNodeFee);
    eventEmitter.off('modifyCurrency', this.modifyCurrency);
    ipcRenderer.off('handleDonate', this.handleDonate);
    ipcRenderer.off('handleVerminting', this.handleVerminting);
    ipcRenderer.off('fromBackend', this.handleBackendMessages);
  }

  modifyCurrency = (displayCurrency: string) => {
    this.setState({
      displayCurrency
    });
    this.resetAmounts();
  };

  updateFiatPrice = (fiatPrice: number) => {
    this.setState({
      fiatPrice
    });
  };

  handleTransactionInProgress = () => {
    this.setState({
      transactionInProgress: true
    });
  };

  handleTransactionCancel = () => {
    this.setState({
      transactionInProgress: false
    });
  };

  handleNewNodeFee = () => {
    this.setState({
      nodeFee: session.getNodeFee()
    });
  };

  handleDonate = () => {
    console.log(this.devContact)
    this.handleAddressChange(this.devContact);
  };

  handleVerminting = () => {
    //this.handleAddressChange(this.vermintingContact);
  };

  handleAmountChange = (event: any) => {
    let enteredAmount = event.target.value;
    if (enteredAmount === '') {
      this.setState({
        enteredAmount: ''
      });
      return;
    }
    if (enteredAmount === '.') {
      enteredAmount = '0.';
    }

    const regex = /^\d*\.?\d{0,8}$/;
    if (!regex.test(enteredAmount) === true) {
      return;
    }

    this.setState({
      enteredAmount
    });
  };

  handleBackendMessages = (event: Electron.IpcRendererEvent, message: any) => {
    const { messageType, data } = message;
    const { darkMode } = this.state;
    const { textColor } = uiType(darkMode);
    if (messageType === 'sendTransactionResponse') {
      if (data.status === 'SUCCESS') {
        this.resetForm();
      }
    }
    if (messageType === 'prepareTransactionResponse') {
      eventEmitter.emit('transactionCancel');
      if (data.status === 'SUCCESS') {
        const networkHeight = session.getNetworkBlockHeight();
        let txFee = Config.minimumFee;
        const { address, paymentID, amount, fee, nodeFee, hash } = data;
        if (networkHeight >= Config.feePerByteHeight) {
          txFee = fee;
        }
        session.setPreparedTransactionHash(hash);
        const modalMessage = (
          <div>
            <center>
              <p className={`title ${textColor}`}>Confirm Transaction</p>
            </center>
            <br />
            <p className={`subtitle ${textColor}`}>
              <b>Send to:</b>
              <br />
              {address}
            </p>
            <p className={`subtitle ${textColor}`}>
              <b>Total Amount: (includes fees)</b>
              <br />
              {atomicToHuman(amount + nodeFee + txFee, true)} {Config.ticker}
            </p>
            <p className={`subtitle ${textColor}`}>
              <b>Fee:</b>
              <br />
              {atomicToHuman(nodeFee + txFee, true)} {Config.ticker}
              {nodeFee > 0 &&
                ` (including a node fee of ${atomicToHuman(
                  nodeFee,
                  true
                )} ${Config.ticker})`}
            </p>{' '}
            {paymentID !== '' && (
              <p className={`subtitle ${textColor}`}>
                <b>Payment ID:</b>
                <br />
                {paymentID}
              </p>
            )}
          </div>
        );
        eventEmitter.emit(
          'openModal',
          modalMessage,
          'Send it!',
          'Wait a minute...',
          'sendTransaction'
        );
      } else {
        log.info(data);
      }
    }
  };

  handleSendToAddressChange = (event: any) => {
    const sendToAddress = event.target.value;
    this.setState({
      sendToAddress
    });
  };

  prepareTransaction = (event: any) => {
    if (event) event.preventDefault();
    const {
      sendToAddress,
      paymentID,
      darkMode,
      displayCurrency,
      enteredAmount,
      fiatPrice,
      sendAll
    } = this.state;
    const { textColor } = uiType(darkMode);

    const sufficientFunds = sendAll
      ? true
      : (session.getUnlockedBalance() + session.getLockedBalance()) / (10 ** Config.decimalPlaces) >=
        Number(enteredAmount);

    const sufficientUnlockedFunds = sendAll
      ? true
      : session.getUnlockedBalance() > Number(enteredAmount) / (10 ** Config.decimalPlaces);

    if (!sendAll && (sendToAddress === '' || enteredAmount === '')) {
      return;
    }

    if (!sufficientFunds) {
      log.info(session.getUnlockedBalance(), session.getLockedBalance());
      log.info(enteredAmount);
      const message = (
        <div>
          <center>
            <p className="title has-text-danger">Error!</p>
          </center>
          <br />
          <p className={`subtitle ${textColor}`}>
            The transaction was not successful. You don&apos;t have enough
            funds!
          </p>
        </div>
      );
      eventEmitter.emit('openModal', message, 'OK', null, 'transactionCancel');
      return;
    }

    if (!sufficientUnlockedFunds) {
      const message = (
        <div>
          <center>
            <p className="title has-text-danger">Error!</p>
          </center>
          <br />
          <p className={`subtitle ${textColor}`}>
            The transaction was not successful.
          </p>
          <p className={`subtitle ${textColor}`}>
            You don&apos;t have enough unlocked funds! Wait until your funds
            unlock then try again.
          </p>
        </div>
      );
      eventEmitter.emit('openModal', message, 'OK', null, null);
      eventEmitter.emit('transactionCancel');
      return;
    }

    const transactionData = {
      address: sendToAddress,
      amount:
        displayCurrency === Config.ticker
          ? Number(enteredAmount) * (10 ** Config.decimalPlaces)
          : (Number(enteredAmount) * (10 ** Config.decimalPlaces)) / fiatPrice,
      paymentID,
      sendAll
    };

    ipcRenderer.send(
      'fromFrontend',
      'prepareTransactionRequest',
      transactionData
    );
  };

  createTestTransaction = async () => {
    const sendToAddress = await session.getPrimaryAddress();
    const amount = 100;
    const paymentID = this.generatePaymentID();

    await this.setState({
      selectedContact: { label: sendToAddress, value: sendToAddress },
      enteredAmount: String(amount / (10 ** Config.decimalPlaces)),
      sendToAddress,
      paymentID,
      sendAll: false
    });
    this.prepareTransaction();
  };

  generatePaymentID = () => {
    const paymentID = crypto.randomBytes(32).toString('hex');
    log.debug(`Generated paymentID: ${paymentID}`);
    this.setState({ paymentID });
    return paymentID;
  };

  handlePaymentIDChange = (event: any) => {
    this.setState({ paymentID: event.target.value });
  };

  resetForm = () => {
    this.setState({
      paymentID: '',
      enteredAmount: '',
      sendToAddress: '',
      selectedContact: null
    });
  };

  resetAmounts = () => {
    this.setState({ enteredAmount: '' });
  };

  sendAll = () => {
    const { unlockedBalance, fiatPrice, displayCurrency, nodeFee } = this.state;

    const totalAmount =
      unlockedBalance - 10 - parseInt(nodeFee, 10) <= 0 ? 0 : unlockedBalance;
    const enteredAmount =
      unlockedBalance - 10 - parseInt(nodeFee, 10) <= 0
        ? 0
        : totalAmount - 10 - parseInt(nodeFee, 10);
    this.setState({
      enteredAmount:
        displayCurrency === Config.ticker
          ? atomicToHuman(enteredAmount, false).toString()
          : atomicToHuman(enteredAmount * fiatPrice, false).toString()
    });
  };

  checkInputLength = (input: string) => {
    if (input.length > 1) {
      this.setState({
        menuIsOpen: true
      });
    } else {
      this.setState({
        menuIsOpen: false
      });
    }
  };

  handleAddressChange = (event: any) => {
    if (event) {
      // eslint-disable-next-line no-underscore-dangle
      if (event.__isNew__ || event.__isDonate__) {
        this.setState({
          selectedContact: { label: event.value, value: event.value },
          sendToAddress: event.value
        });
        return;
      }

      const { paymentID } = search(
        event.value,
        [donateInfo, ...addressList],
        'address'
      );

      this.setState({
        selectedContact: event,
        sendToAddress: event.value,
        paymentID: paymentID || ''
      });
    } else {
      this.setState({
        selectedContact: null
      });
    }
  };

  roundDown(x: number) {
    return Math.floor(x * 100) / 100;
  }

  render() {
    const {
      darkMode,
      enteredAmount,
      paymentID,
      transactionInProgress,
      displayCurrency,
      fiatSymbol,
      symbolLocation,
      sendToAddress,
      pageAnimationIn,
      selectedContact,
      menuIsOpen,
      sendAll
    } = this.state;

    const exampleAmount =
      symbolLocation === 'prefix' ? `${fiatSymbol}100` : `100${fiatSymbol}`;

    const {
      backgroundColor,
      textColor,
      elementBaseColor,
      toolTipColor,
      linkColor
    } = uiType(darkMode);

    const addressInput = (
      <a
        href="#addressinput"
        onClick={event => event.preventDefault()}
        id="#addressinput"
      >
        <Creatable
          multi
          options={this.autoCompleteContacts}
          placeholder={i18n.send_placeholder}
          // eslint-disable-next-line no-unused-vars
          noOptionsMessage={inputValue => null}
          styles={customStyles}
          isClearable
          formatCreateLabel={value => {
            return i18n.formatString(i18n.send_to_value, { value });
          }}
          value={selectedContact}
          onChange={this.handleAddressChange}
          id="autoCompleteAddress"
          menuIsOpen={menuIsOpen}
          onInputChange={this.checkInputLength}
        />
      </a>
    );

    return (
      <div>
        <Redirector />
        <div className={`wholescreen ${backgroundColor}  hide-scrollbar`}>
          <ReactTooltip
            effect="solid"
            type={toolTipColor}
            multiline
            place="top"
          />
          <NavBar darkMode={darkMode} />
          <div className={`maincontent ${backgroundColor} ${pageAnimationIn}`}>
            <form onSubmit={this.prepareTransaction}>
              <div className="field">
                <div className="control">
                  <label
                    className={`label ${textColor}`}
                    htmlFor="autoCompleteAddress"
                  >
                    {i18n.send_to}
                    {addressInput}
                  </label>
                </div>
              </div>

              <div className="field" hidden>
                <label className={`label ${textColor}`} htmlFor="address">
                  {i18n.send_to_address}
                  <div className="control">
                    <input
                      className="input is-large"
                      type="text"
                      placeholder={i18n.send_to_address_input_placeholder}
                      value={sendToAddress}
                      onChange={this.handleSendToAddressChange}
                      id="address"
                    />
                  </div>
                </label>
              </div>
              <div className="field">
                <div className="control">
                  <label className={`label ${textColor}`} htmlFor="amount">
                    {i18n.amount_to_send}
                    <input
                      className="input is-large"
                      type="text"
                      placeholder={
                        sendAll
                          ? i18n.send_entire_balance
                          : `${i18n.send_how_much} (eg. ${
                              displayCurrency === 'fiat'
                                ? exampleAmount
                                : `100 ${Config.ticker}`
                            })`
                      }
                      value={enteredAmount}
                      onChange={this.handleAmountChange}
                      id="amount"
                      disabled={sendAll}
                    />
                    <label className="checkbox">
                      <p className={textColor}>
                        <input
                          type="checkbox"
                          checked={sendAll}
                          onChange={event => {
                            this.setState({
                              sendAll: event.target.checked,
                              enteredAmount: ''
                            });
                          }}
                        />{' '}
                        {i18n.send_all}
                      </p>
                    </label>
                  </label>
                </div>
              </div>
              <div className="field">
                <label className={`label ${textColor}`} htmlFor="paymentid">
                  {i18n.payment_id}
                  <div className="control">
                    <input
                      className="input is-large"
                      type="text"
                      placeholder={i18n.payment_id_input_placeholder}
                      value={paymentID}
                      onChange={this.handlePaymentIDChange}
                      id="paymentid"
                    />
                    <a
                      onClick={this.generatePaymentID}
                      onKeyPress={this.generatePaymentID}
                      role="button"
                      tabIndex={0}
                      className={linkColor}
                      onMouseDown={event => event.preventDefault()}
                    >
                      {i18n.generate_payment_id}
                    </a>
                  </div>
                </label>
              </div>
              <div className="buttons">
                {!transactionInProgress && (
                  <button type="submit" className="button is-success is-large">
                    <span className="icon is-small">
                      <i className="fa fa-paper-plane" />
                    </span>
                    &nbsp;&nbsp;{i18n.send}
                  </button>
                )}
                {transactionInProgress && (
                  <button
                    type="submit"
                    className="button is-success is-large is-loading is-disabled"
                    disabled
                  >
                    <span className="icon is-small">
                      <i className="fa fa-paper-plane" />
                    </span>
                    &nbsp;&nbsp;{i18n.send}
                  </button>
                )}

                <button
                  type="reset"
                  className={`button is-large ${elementBaseColor}`}
                  onClick={this.resetForm}
                >
                  <span className="icon is-small">
                    <i className="fa fa-undo" />
                  </span>
                  &nbsp;&nbsp;{i18n.clear}
                </button>
                {isDev && (
                  <div>
                    <a
                      className="button is-warning is-large"
                      onClick={this.createTestTransaction}
                      onKeyPress={this.createTestTransaction}
                      role="button"
                      tabIndex={0}
                      type="action"
                      onMouseDown={event => event.preventDefault()}
                    >
                      <span className="icon is-small">
                        <i className="fa fa-flask" />
                      </span>
                      &nbsp;&nbsp;{i18n.test}
                    </a>
                  </div>
                )}
              </div>
            </form>
          </div>
          <BottomBar darkMode={darkMode} />
        </div>
      </div>
    );
  }
}

Send.defaultProps = {
  uriAddress: '',
  uriPaymentID: ''
};
