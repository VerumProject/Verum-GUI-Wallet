import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import {
  validateAddress,
  validatePaymentID
} from 'turtlecoin-wallet-backend/dist/lib/ValidateParameters';
import NavBar from './NavBar';
import BottomBar from './BottomBar';
import Redirector from './Redirector';
import { uiType } from '../utils/utils';
import { session, loginCounter, config, eventEmitter } from '../index';
import routes from '../constants/routes';
import Config from '../../Config';
import { ipcRenderer } from 'electron';
import { getStats, registerWallet, unvermint, getAddress } from './../wallet/vermintingAPI';

type State = {
  darkMode: boolean,
  pageAnimationIn: string
};

type Props = {};

class Verminting extends Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      darkMode: config.darkMode,
      pageAnimationIn: loginCounter.getAnimation('/verminting'),
      privKeySaved: "",
      balance: 0,
      lockedBalance: 0,
      estRewardPercentage: 0,
      estRewardCoins: 0,
      amount: "",
      connectedState: "init",
      autoRefresh: "",
      notificationMessage: "",
      notificationType: "success",
      notificationOpacity: "0",
      vermintingEnabled: (session.getNetworkBlockHeight() >= 86400),
      vermintingEnabledHeight: 86400,
      vermintingToGo: 86400 - session.getNetworkBlockHeight()
    };
  }

  componentDidMount() {
    // Request privateView
    ipcRenderer.send('fromFrontend', 'getPrivateView');

    ipcRenderer.on('fromBackend', this.handleBackendMessages);
  }

  componentWillUnmount() {
    // Clear interval
    clearInterval(this.autoRefresh);
    ipcRenderer.off('fromBackend', this.handleBackendMessages);
  }

  // Notification function
  notify = (type, message) => {
    this.updateNotificationMessage(message);
    this.updateNotificationType(type);
    setTimeout(() => {
      this.updatenotificationOpacity("1");
    }, 50);
    setTimeout(() => {
      this.updatenotificationOpacity("0");
    }, 5000)
  };

  // Refresh stats data
  refreshStats = async (data) => {
    let getBalanceData = await getStats(data);

    this.setState({
      vermintingToGo: this.state.vermintingEnabledHeight - session.getNetworkBlockHeight(),
      vermintingEnabled: (session.getNetworkBlockHeight() >= this.state.vermintingEnabledHeight)
    });

    // If connection has failed
    if(!getBalanceData) {
      // If connectionState is set to true
      if(this.getConnectedState() == true) {
        // Notification
        this.notify("error", "Disconnected");
      }

      // Update connected state
      this.updateConnectedState(false);
      return;
    }

    // If connectionState is set to false
    if(!(this.getConnectedState() == "init")) {
      if(this.getConnectedState() == false) {
        // Notification
        this.notify("success", "Connection reestablish");
      }
    }

    // If connection has succeeded but error, else success
    if(!getBalanceData.success) {
      // If not registered, try to register
      if(getBalanceData.errorCode == 1) {
        let registerWalletData = await registerWallet(data, session.getPrimaryAddress());
        if(registerWalletData.success) {
          console.log('[VERMINTING] Wallet has been registrered')
        }
      }
    } else {
      this.updateBalance(getBalanceData.result.balance.balance);
      this.updateLockedBalance(getBalanceData.result.balance.lockedBalance);
      this.updateRates(getBalanceData.result.estRewardPercentage);
      this.updateRatesCoins(getBalanceData.result.estRewardCoins);
      this.updateConnectedState(true);
    }
  }

  // Handle messages from the backend (in this case only to get private key so we can sh256 hash it)
  handleBackendMessages = async (event: Electron.IpcRendererEvent, message: any) => {
    const { messageType, data } = message;
    
    if (messageType === 'getPrivateView') {
      await this.refreshStats(data);
      this.privKeySaved = data;
      
      // Interval every 30 seconds to refresh data
      this.autoRefresh = setInterval(async () => {
        console.log('[VERMINTING] Autorefresh from interval');
        await this.refreshStats(this.privKeySaved);
      }, 15000);
    }
  };

  // Update connected state
  updateConnectedState = (connectedState: number) => {
    this.setState({
      connectedState
    });
  };

  // Get connected state
  getConnectedState = () => {
    return this.state.connectedState;
  };

  // Update the balance
  updateBalance = (balance: number) => {
    this.setState({
      balance
    });
  };
  
  // Update the locked balance
  updateLockedBalance = (lockedBalance: number) => {
    this.setState({
      lockedBalance
    });
  };
  
  // Update the locked balance
  updateRates = (estRewardPercentage: number) => {
    this.setState({
      estRewardPercentage
    });
  };
  
  // Update the locked balance
  updateRatesCoins = (estRewardCoins: number) => {
    this.setState({
      estRewardCoins
    });
  };

  // Update notification message
  updateNotificationMessage = (notificationMessage: number) => {
    this.setState({
      notificationMessage
    });
  };

  // Update notification type
  updateNotificationType = (notificationType: number) => {
    this.setState({
      notificationType
    });
  };

  // Update notification opacity
  updatenotificationOpacity = (notificationOpacity: number) => {
    this.setState({
      notificationOpacity
    });
  };

  // Input change on amountb ox
  handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    // Validate the value to allow only numbers with up to 8 decimal places
    const regex = /^\d*\.?\d{0,8}$/;

    if (regex.test(value)) {
      this.setState({
        amount: value
      });
    }
  };

  // Handles vermint action
  handleVermint = async () => {
    const { amount } = this.state;

    if (amount && !isNaN(parseFloat(amount))) {
      let getAddressData = await getAddress(this.privKeySaved);
      
      eventEmitter.emit('goToVerminting', `verminting:${getAddressData.result}:${amount}`);
    } else {
      this.notify("error", "Please enter a valid amount");
    }
  };

  // Handles unvermint action
  handleUnvermint = async () => {
    const { amount } = this.state;

    if (amount && !isNaN(parseFloat(amount))) {
      await this.unvermintCoins(amount);
    } else {
      this.notify("error", "Please enter a valid amount");
    }
  };

  unvermintCoins = async (amount) => {
    let unvermintData = await unvermint(this.privKeySaved, amount);

    // Show notification on success or error
    if(unvermintData.success) {
      await this.notify("success", `TXID: ${unvermintData.result.tx_hash}`);
    } else {
      if(unvermintData.errorCode == 7) {
        await this.notify("error", unvermintData.result.message);
      } else {
        await this.notify("error", `Something went wrong`);
      }
    }

    // Refresh stats
    this.refreshStats(this.privKeySaved);
  }

  render() {
    const {
      darkMode,
      pageAnimationIn,
      balance,
      lockedBalance,
      estRewardPercentage,
      estRewardCoins,
      amount,
      connectedState,
      notificationMessage,
      notificationType,
      notificationOpacity,
      vermintingEnabled,
      vermintingToGo
    } = this.state;

    const { backgroundColor, tableMode, textColor, fillColor } = uiType(
      darkMode
    );

    return (
      <div>
        <Redirector />
        <div className={`wholescreen ${backgroundColor} hide-scrollbar`}>
          <NavBar darkMode={darkMode} />

          <div className={`maincontent-homescreen mainUnit ${backgroundColor} ${pageAnimationIn} `}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', width: '380px' }}>

                <div style={{ backgroundColor: '#209cee', height: '70px', display: 'flex', borderRadius: '9px', marginTop: '14px' }}>
                  <div style={{ width: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', border: '2px solid #54b3f2', borderTopLeftRadius: '9px', borderRight: '0px' }}>
                    <span style={{ fontSize: '18px' }}><b>Balance</b></span>
                    <span>{parseFloat(balance).toFixed(8)} VRM</span>
                  </div>
                  <div style={{ width: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', border: '2px solid #54b3f2', borderTopRightRadius: '9px' }}>
                    <span style={{ fontSize: '18px' }}><b>Locked</b></span>
                    <span>{parseFloat(lockedBalance).toFixed(8)} VRM</span>
                  </div>
                </div>
                <div style={{ backgroundColor: '#209cee', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', borderRadius: '9px', borderTopLeftRadius: '0px', borderTopRightRadius: '0px', border: '2px solid #54b3f2', borderTop: '0px' }}>
                  <span><b>Estimated block reward</b></span>
                  <span>{estRewardCoins} VRM ({estRewardPercentage}%)</span>
                </div>

                <input
                  style={{ marginTop: '15px', fontSize: '18px' }}
                  className="input is-large"
                  type="text"
                  placeholder="Amount"
                  id="amount"
                  value={amount}
                  onChange={this.handleInputChange}
                  disabled={(this.state.connectedState ? !this.state.vermintingEnabled : true)}
                />

                <div style={{ marginTop: '15px', display: 'flex' }}>
                  <div style={{ width: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                    <button
                      type="button"
                      className="button is-success"
                      onClick={this.handleVermint}
                      disabled={(this.state.connectedState ? !this.state.vermintingEnabled : true)}
                    >
                      Vermint
                    </button>
                  </div>
                  <div style={{ width: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                    <button
                      type="button"
                      className="button is-danger"
                      onClick={this.handleUnvermint}
                      disabled={(this.state.connectedState ? !this.state.vermintingEnabled : true)}
                    >
                      Unvermint
                    </button>
                  </div>
                </div>

                <div style={{ position: 'absolute', right: '0px', top: '15px' }}>
                  <span style={{ backgroundColor: (connectedState ? '#43c15e' : '#e24646'), padding: '2px 10px', borderRadius: '50px' }}>
                    {connectedState ? (<i className="fas fa-link"></i>) : (<i className="fas fa-unlink"></i>)}
                  </span>
                </div>

                <div style={{ opacity: notificationOpacity, transition: 'all .25s ease-in-out', position: 'absolute', right: '0px', bottom: '20px', display: 'flex' }}>
                  <div style={{ backgroundColor: (notificationType == "info" ? '#5e9cb9' : '') + (notificationType == "success" ? '#5eb96e' : '') + (notificationType == "error" ? '#c9263f' : ''), borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', padding: '0px 10px', display: 'flex', alignItems: 'center', border: `1px solid ${(notificationType == "info" ? '#8eb9cd' : '') + (notificationType == "success" ? '#addbb6' : '') + (notificationType == "error" ? '#df586c' : '')}`, borderRight: '0px' }}>
                    <i className={`fas fa-${(notificationType == "info" ? 'info' : '') + (notificationType == "error" ? 'times' : '') + (notificationType == "success" ? 'check' : '')}`}></i>
                  </div>
                  <div style={{ backgroundColor: '#9f1e31', padding: '12px 14px', borderTopRightRadius: '8px', borderBottomRightRadius: '8px', border: '1px solid #df586c', borderLeft: '0px', paddingLeft: '9px' }}>
                    {notificationMessage}
                  </div>
                </div>

              </div>

              {(!this.state.vermintingEnabled ? (
                <div className={"toGoCard"} style={{ display: 'flex', marginTop: '14px' }}>
                  {vermintingToGo.toLocaleString('en-us')} blocks to go until activation
                </div>
              ): '')}

              <div className={"informationCard"} style={{ marginTop: '13px', display: 'flex', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', fontWeight: '500' }}><span style={{ marginRight: '3px' }}><i className={"fas fa-info-circle"}></i></span> Information</span>

                <span>1. Unverminting will use 10000 VERI (0.0001 VRM)</span>
                <span style={{ marginLeft: '17px' }}>of your balance for the transaction fee.</span>
                <span>2. You need at least 3 VRM to start verminting.</span>
                <span>3. Estimated block reward (in percentage) is calculated</span>
                <span style={{ marginLeft: '17px' }}>by <code>(Your Coins / Total Coins) * 100</code></span>
              </div>
            </div>
          </div>

          <BottomBar darkMode={darkMode} />
        </div>
      </div>
    );
  }
}

export default withRouter(Verminting);