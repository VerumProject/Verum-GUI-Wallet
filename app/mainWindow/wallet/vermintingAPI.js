import request from 'request-promise';
import crypto from 'crypto';

let api_url = "https://verumcoin.nl/verminting/api";

// Hash data
export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}


export async function getStats(key) {
  try {
    const result = await request({
      method: 'POST',
      uri: `${api_url}/get_stats`,
      headers: {},
      json: true,
      body: {
        hashedPrivateViewKey: sha256(key)
      }
    });
    
    console.log('[VERMINTING] Updating verminting stats');

    return result;
  } catch (err) {
    if (err.statusCode === 400) {
      return err.error;
    } else {
      console.error('[VERMINTING]', err.message);
      return false;
    }
  }
}

export async function unvermint(key, amount) {
  try {
    const result = await request({
      method: 'POST',
      uri: `${api_url}/unvermint`,
      headers: {},
      json: true,
      body: {
        hashedPrivateViewKey: sha256(key),
        amount: amount
      }
    });
    return result;
  } catch (err) {
    if (err.statusCode === 400) {
      return err.error;
    } else {
      console.error('[VERMINTING] [UNVERMINT]', err.message);
      return false;
    }
  }
}

export async function getAddress(key, amount) {
  try {
    const result = await request({
      method: 'POST',
      uri: `${api_url}/get_deposit_address`,
      headers: {},
      json: true,
      body: {
        hashedPrivateViewKey: sha256(key)
      }
    });
    return result;
  } catch (err) {
    if (err.statusCode === 400) {
      return err.error;
    } else {
      console.error('[VERMINTING] [GET_ADDRESS]', err.message);
      return false;
    }
  }
}

export async function registerWallet(key, address) {
  try {
    const result = await request({
      method: 'POST',
      uri: `${api_url}/register_wallet`,
      headers: {},
      json: true,
      body: {
        hashedPrivateViewKey: sha256(key),
        address: address
      }
    });
    return result;
  } catch (err) {
    if (err.statusCode === 400) {
      return err.error;
    } else {
      console.log('Error occurred:', err.message);
      return false;
    }
  }
}