import {Injectable} from '@angular/core';

import * as EOSJS from '../../assets/eos.js';
import {BehaviorSubject, Subject} from 'rxjs';
import {reject} from 'q';

@Injectable()
export class EOSJSService {
	eosio: any;
	tokens: any;
	public ecc: any;
	format: any;
	ready: boolean;
	status = new Subject<Boolean>();
	txh: any[];
	actionHistory: any[];
	abiSmartContract = '';
	abiSmartContractActions = [];
	abiSmartContractStructs = [];
	baseConfig = {
		keyProvider: [],
		httpEndpoint: '',
		expireInSeconds: 60,
		broadcast: true,
		debug: false,
		sign: true,
		chainId: ''
	};

	basePublicKey = '';
	auth = false;
	constitution = '';
	txCheckQueue = [];
	txMonitorInterval = null;

	public accounts = new BehaviorSubject<any>({});
	public online = new BehaviorSubject<boolean>(false);
	public chainID: string;
	public eos: any;

	constructor() {
		this.eosio = null;
		this.ecc = EOSJS.modules['ecc'];
		this.format = EOSJS.modules['format'];
		this.ready = false;
		this.txh = [];
		this.actionHistory = [];
	}

	reloadInstance() {
		this.auth = true;
		this.eos = EOSJS(this.baseConfig);
	}

	clearInstance() {
		this.baseConfig.keyProvider = [];
		this.eos = EOSJS(this.baseConfig);
	}

	clearSigner() {
		console.log(this.eos);
	}

	loadNewConfig(signer) {
		this.eos = EOSJS({
			httpEndpoint: this.baseConfig.httpEndpoint,
			signProvider: signer,
			chainId: this.chainID,
			sign: true,
			broadcast: true
		});
	}

	init(url, chain) {
		this.chainID = chain;
		return new Promise((resolve, reject) => {
			this.baseConfig.chainId = this.chainID;
			this.baseConfig.httpEndpoint = url;
			this.eos = EOSJS(this.baseConfig);
			this.eos['getInfo']({}).then(result => {
				this.ready = true;
				this.online.next(result['head_block_num'] - result['last_irreversible_block_num'] < 400);
				let savedAcc = [];
				const savedpayload = localStorage.getItem('simpleos.accounts.' + this.chainID);
				if (savedpayload) {
					savedAcc = JSON.parse(savedpayload).accounts;
					this.loadHistory();
				}
				this.eos['contract']('eosio').then(contract => {
					this.eosio = contract;
					// console.log(savedAcc);
					resolve(savedAcc);
				});
			}).catch((err) => {
				reject(err);
			});
		});
	}

	getKeyAccounts(pubkey) {
		return this.eos.getKeyAccounts(pubkey);
	}

	getAccountInfo(name) {
		return this.eos['getAccount'](name);
	}

	getAccountActions(account, offset, position): Promise<any> {
		return new Promise((resolve2, reject2) => {
			this.eos['getActions']({
				account_name: account,
				offset: offset,
				pos: position
			}).then(data => {
				resolve2(data);
				// console.log(data);
			}).catch(error => {
				reject2(error);
				// console.log(error);
			});
		});
	}

	getChainInfo(): Promise<any> {
		if (this.eos) {
			return this.eos['getTableRows']({
				json: true,
				code: 'eosio',
				scope: 'eosio',
				table: 'global'
			});
		} else {
			return new Promise(resolve => {
				resolve();
			});
		}
	}

	getDappMetaData(dapp): Promise<any> {
		if (this.eos) {
			return this.eos['getTableRows']({
				json: true,
				code: 'dappmetadata',
				scope: dapp,
				table: 'dapps'
			});
		} else {
			return new Promise(resolve => {
				resolve();
			});
		}
	}

	getRamMarketInfo(): Promise<any> {
		if (this.eos) {
			return this.eos['getTableRows']({
				json: true,
				code: 'eosio',
				scope: 'eosio',
				table: 'rammarket'
			});
		} else {
			return new Promise(resolve => {
				resolve();
			});
		}
	}

	getRefunds(account): Promise<any> {
		return this.eos['getTableRows']({
			json: true,
			code: 'eosio',
			scope: account,
			table: 'refunds'
		});
	}

	getProposals(contract, limmit): Promise<any> {
		if (this.eos) {
			return this.eos['getTableRows']({
				json: true,
				code: contract,
				scope: contract,
				table: 'proposal',
				limit: limmit
			});
		} else {
			return new Promise((resolve) => {
				resolve([]);
			});
		}
	}

	listDelegations(account): Promise<any> {
		return this.eos['getTableRows']({
			json: true,
			code: 'eosio',
			scope: account,
			table: 'delband'
		});
	}

	unDelegate(from: string, receiver: string, net: string, cpu: string, symbol: string) {
		// console.log(from, receiver, (net+' EOS'), (cpu+' EOS'));
		return this.eos.undelegatebw(from, receiver, (net + ' ' + symbol), (cpu + ' ' + symbol));
	}

	delegateBW(from: string, receiver: string, net: string, cpu: string, symbol: string) {
		// console.log(from, receiver, (net +' EOS'), (cpu +' EOS'));
		return new Promise((resolve, reject) => {
			this.eos.delegatebw(from, receiver, (net + ' ' + symbol), (cpu + ' ' + symbol), 0).then(data => {
				resolve(data);
			}).catch(err2 => {
				reject(err2);
			});
		});
	}

	claimRefunds(account, k): Promise<any> {
		this.baseConfig.keyProvider = [k];
		const tempEos = EOSJS(this.baseConfig);
		return tempEos['refund']({owner: account}, {
			broadcast: true,
			sign: true,
			authorization: account + '@active'
		});
	}

	checkAccountName(name) {
		return this.format['encodeName'](name);
	}

	loadPublicKey(pubkey) {
		return new Promise((resolve, reject2) => {
			if (this.ecc['isValidPublic'](pubkey)) {
				const tempAccData = [];
				this.getKeyAccounts(pubkey).then((data) => {
					// console.log('load', data);
					// if (data['account_names'].length > 0) {
					if (data.length > 0) {
						const promiseQueue = [];
						// data['account_names'].forEach((acc) => {
						data.forEach((acc) => {
							const tempPromise = new Promise((resolve1, reject1) => {
								// this.getAccountInfo(acc).then((acc_data) => {
								this.getAccountInfo(acc.account).then((acc_data) => {
									tempAccData.push(acc_data);
									// if (acc_data.permissions[0]['required_auth']['keys'][0].key === pubkey) {
									this.getTokens(acc_data['account_name']).then((tokens) => {
										acc_data['tokens'] = tokens;
										this.accounts[acc] = acc_data;
										tempAccData.push(acc_data);
										resolve1(acc_data);
									}).catch((err) => {
										console.log(err);
										reject1();
									});
									// } else {
									//   reject1();
									// }
								});
							});
							promiseQueue.push(tempPromise);
						});
						Promise.all(promiseQueue).then((results) => {
							resolve({
								foundAccounts: results,
								publicKey: pubkey
							});
						}).catch(() => {
							console.log(data);
							reject2({
								message: 'non_active',
								accounts: data
							});
						});
					} else if (data['account_names'].length > 0) {

						const promiseQueue = [];
						data['account_names'].forEach((acc) => {
							// data.forEach((acc) => {
							const tempPromise = new Promise((resolve1, reject1) => {
								this.getAccountInfo(acc).then((acc_data) => {
									tempAccData.push(acc_data);
									// console.log(acc_data.permissions[0]['required_auth']['keys'][0].key);
									if (acc_data.permissions[0]['required_auth']['keys'][0].key === pubkey) {
										this.getTokens(acc_data['account_name']).then((tokens) => {
											acc_data['tokens'] = tokens;
											this.accounts[acc] = acc_data;
											resolve1(acc_data);
										}).catch((err) => {
											console.log(err);
											reject1();
										});
									} else {
										reject1();
									}
								});
							});
							promiseQueue.push(tempPromise);
						});
						Promise.all(promiseQueue).then((results) => {
							resolve({
								foundAccounts: results,
								publicKey: pubkey
							});
						}).catch(() => {
							console.log(data);
							reject2({
								message: 'non_active',
								accounts: tempAccData
							});
						});
					} else {
						reject2({message: 'no_account'});
					}
				}).catch((api_error) => {
					console.log(api_error);
					reject2({message: 'api_error'});
				});
			} else {
				reject2({message: 'invalid'});
			}
		});
	}

	async storeAccountData(accounts) {
		if (accounts) {
			if (accounts.length > 0) {
				this.accounts.next(accounts);
				const payload = JSON.parse(localStorage.getItem('simpleos.accounts.' + this.chainID));
				payload.updatedOn = new Date();
				payload.accounts = accounts;
				localStorage.setItem('simpleos.accounts.' + this.chainID, JSON.stringify(payload));
				return true;
			} else {
				return false;
			}
		} else {
			return null;
		}
	}

	listProducers() {
		return this.eos['getProducers']({json: true, limit: 100});
	}

	getTokens(name) {
		return this.eos['getCurrencyBalance']('eosio.token', name);
	}

	getTransaction(hash) {
		if (this.ready) {
			this.eos['getTransaction'](hash).then((result) => {
				this.txh.push(result);
				this.saveHistory();
				this.loadHistory();
			});
		}
	}

	getConstitution() {
		this.eos['getAbi']('eosio').then((data) => {
			const temp = data['abi']['ricardian_clauses'][0]['body'];
			this.constitution = temp.replace(/(?:\r\n|\r|\n)/g, '<br>');
		});
	}

	getSCAbi(contract) {
		return this.eos['getAbi'](contract);
	}

	pushActionContract(contract, action, form, account) {
		const options = {authorization: account + '@active'};
		return new Promise((resolve, reject2) => {
			this.eos['contract'](contract).then((tc) => {
				if (tc[action]) {
					tc[action](form, options).then(dt => {
						resolve(dt);
					}).catch(err => {
						reject2(err);
					});
				}
			}).catch(err2 => {
				reject2(err2);
			});
		});
	}

	loadHistory() {
		this.actionHistory = [];
	}

	saveHistory() {
		const payload = JSON.stringify(this.txh);
		localStorage.setItem('simpleos.txhistory.' + this.chainID, payload);
	}

	async transfer(contract, from, to, amount, memo): Promise<any> {
		if (this.auth) {
			if (contract === 'eosio.token') {
				return new Promise((resolve, reject) => {
					this.eos['transfer'](from, to, amount, memo, (err, trx) => {
						// console.log(err, trx);
						if (err) {
							reject(JSON.parse(err));
						} else {
							resolve(true);
						}
					});
				});
			} else {
				return new Promise((resolve, reject) => {
					this.eos['contract'](contract, (err, tokenContract) => {
						if (!err) {
							if (tokenContract['transfer']) {
								const options = {authorization: from + '@active'};
								tokenContract['transfer'](from, to, amount, memo, options, (err2, trx) => {
									// console.log(err, trx);
									if (err2) {
										reject(JSON.parse(err2));
									} else {
										resolve(true);
									}
								});
							} else {
								reject();
							}
						} else {
							reject(JSON.parse(err));
						}
					});
				});
			}
		}
	}

	checkPvtKey(k): Promise<any> {
		try {
			const pubkey = this.ecc['privateToPublic'](k);
			console.log(pubkey);
			return this.loadPublicKey(pubkey);
		} catch (e) {
			console.log(e);
			return new Promise((resolve, reject) => {
				reject(e);
			});
		}
	}

	ramBuyBytes(payer: string, receiver: string, bytes: string): Promise<any> {
		return this.eos.buyrambytes(payer, receiver, parseInt(bytes));
	}

	ramBuyEOS(payer: string, receiver: string, quant: number, symbol: string): Promise<any> {
		return this.eos.buyram(payer, receiver, quant.toFixed(4) + ' ' + symbol);
	}

	ramSellBytes(account: string, bytes: string): Promise<any> {
		return this.eos.sellram(account, parseInt(bytes));
	}

	async createAccount(creator: string, name: string, owner: string,
						active: string, delegateAmount: number,
						rambytes: number, transfer: boolean,
						giftAmount: number, giftMemo: string, symbol: string): Promise<any> {
		if (this.auth) {
			return this.eos.transaction(tr => {
				tr['newaccount']({creator: creator, name: name, owner: owner, active: active});
				tr['buyrambytes']({payer: creator, receiver: name, bytes: rambytes});
				tr['delegatebw']({
					from: creator, receiver: name,
					stake_net_quantity: (delegateAmount * 0.3).toFixed(4) + ' ' + symbol,
					stake_cpu_quantity: (delegateAmount * 0.7).toFixed(4) + ' ' + symbol,
					transfer: transfer ? 1 : 0
				});
				if (giftAmount > 0) {
					tr['transfer']({
						from: creator,
						to: name,
						quantity: giftAmount.toFixed(4) + ' ' + symbol,
						memo: giftMemo
					});
				}
			});
		} else {
			return new Promise(resolve => resolve(null));
		}
	}

	startMonitoringLoop() {
		if (!this.txMonitorInterval) {
			// console.log('Starting monitoring loop!');
			this.txMonitorInterval = setInterval(() => {
				this.eos['getInfo']({}).then((info) => {
					const lib = info['last_irreversible_block_num'];
					if (this.txCheckQueue.length > 0) {
						console.log('Loop pass - LIB = ' + lib);
						this.txCheckQueue.forEach((tx, idx) => {
							console.log(tx);
							if (lib > tx.block) {
								this.eos['getTransaction']({id: tx.id}).then((result) => {
									console.log(result.id);
									if (result.id === tx.id) {
										this.txh.push(result);
										console.log(result);
										this.txCheckQueue.splice(idx, 1);
										this.saveHistory();
										this.loadHistory();
									}
								});
							}
						});
					} else {
						if (this.txMonitorInterval !== null) {
							console.log('Stopping monitoring loop!');
							clearInterval(this.txMonitorInterval);
							this.txMonitorInterval = null;
						}
					}
				});
			}, 500);
		} else {
			console.log('monitor is already polling');
		}
	}

	async voteProducer(voter: string, list: string[]): Promise<any> {
		if (list.length <= 30) {
			const currentVotes = list;
			currentVotes.sort();
			// const info = await this.eos['getInfo']({}).then(result => {
			//   return result;
			// });
			// const broadcast_lib = info['last_irreversible_block_num'];
			// console.log(this.eos);
			const options = {authorization: voter + '@active'};
			return this.eosio['voteproducer'](voter, '', currentVotes, options).then(data => {
				return JSON.stringify(data);
			}).catch(err => {
				return err;
			});
			// return new Promise((resolve, reject) => {
			//   const cb = (err, res) => {
			//     if (err) {
			//       reject(JSON.parse(err));
			//     } else {
			//       console.log(res);
			//       // setTimeout(() => {
			//       //   this.txCheckQueue.push({
			//       //     block: broadcast_lib,
			//       //     id: res['transaction_id']
			//       //   });
			//       //   this.startMonitoringLoop();
			//       // }, 1000);
			//       resolve(res);
			//     }
			//   };
			//
			// });
		} else {
			return new Error('Cannot cast more than 30 votes!');
		}
	}

	async changebw(account, amount, symbol, ratio) {
		let cpu_v, net_v;
		const accountInfo = await this.eos['getAccount'](account);
		const refund = accountInfo['refund_request'];
		const liquid_bal = accountInfo['core_liquid_balance'];
		let ref_cpu = 0;
		let ref_net = 0;
		let liquid = 0;

		if (liquid_bal) {
			liquid = Math.round(parseFloat(liquid_bal.split(' ')[0]) * 10000);
		}

		if (refund) {
			ref_cpu = Math.round(parseFloat(refund['cpu_amount'].split(' ')[0]) * 10000);
			ref_net = Math.round(parseFloat(refund['net_amount'].split(' ')[0]) * 10000);
		}
		const current_stake = accountInfo['cpu_weight'] + accountInfo['net_weight'];
		const new_total = current_stake + amount;
		const new_cpu = new_total * ratio;
		const new_net = new_total * (1 - ratio);
		let cpu_diff = new_cpu - accountInfo['cpu_weight'];
		let net_diff = new_net - accountInfo['net_weight'];

		if (cpu_diff > (ref_cpu + liquid)) {
			net_diff += (cpu_diff - (ref_cpu + liquid));
			cpu_diff = (ref_cpu + liquid);
		}

		if (net_diff > (ref_net + liquid)) {
			cpu_diff += (cpu_diff - (ref_cpu + liquid));
			net_diff = (ref_net + liquid);
		}
		console.log('CPU DIFF: ', cpu_diff, 'NET DIFF: ', net_diff);
		return this.eos.transaction((tr) => {
			if (cpu_diff < 0 && net_diff >= 0) {
				// Action 1 - Unstake CPU only
				net_v = '0.0000';
				cpu_v = ((Math.abs(cpu_diff)) / 10000).toFixed(4);
				console.log('NET: ', net_v, 'CPU: ', cpu_v);
				tr['undelegatebw']({
					from: account,
					receiver: account,
					unstake_net_quantity: net_v + ' ' + symbol,
					unstake_cpu_quantity: cpu_v + ' ' + symbol
				});
				if (net_diff > 0) {
					// Action 2 - Stake NET only
					cpu_v = '0.0000';
					net_v = (net_diff / 10000).toFixed(4);
					console.log('NET: ', net_v, 'CPU: ', cpu_v);
					tr['delegatebw']({
						from: account,
						receiver: account,
						stake_net_quantity: net_v + ' ' + symbol,
						stake_cpu_quantity: cpu_v + ' ' + symbol,
						transfer: 0
					});
				}
			} else if (net_diff < 0 && cpu_diff >= 0) {
				// Action 1 - Unstake NET only
				net_v = ((Math.abs(net_diff)) / 10000).toFixed(4);
				cpu_v = '0.0000';
				console.log('NET: ', net_v, 'CPU: ', cpu_v);
				tr['undelegatebw']({
					from: account,
					receiver: account,
					unstake_net_quantity: net_v + ' ' + symbol,
					unstake_cpu_quantity: cpu_v + ' ' + symbol
				});
				// Action 2 - Stake CPU only
				if (cpu_diff > 0) {
					net_v = '0.0000';
					cpu_v = (cpu_diff / 10000).toFixed(4);
					console.log('NET: ', net_v, 'CPU: ', cpu_v);
					tr['delegatebw']({
						from: account,
						receiver: account,
						stake_net_quantity: net_v + ' ' + symbol,
						stake_cpu_quantity: cpu_v + ' ' + symbol,
						transfer: 0
					});
				}
			} else if (net_diff < 0 && cpu_diff < 0) {
				// Action 1 - Unstake Both
				cpu_v = ((Math.abs(cpu_diff)) / 10000).toFixed(4);
				net_v = ((Math.abs(net_diff)) / 10000).toFixed(4);
				console.log('NET: ', net_v, 'CPU: ', cpu_v);
				tr['undelegatebw']({
					from: account,
					receiver: account,
					unstake_net_quantity: net_v + ' ' + symbol,
					unstake_cpu_quantity: cpu_v + ' ' + symbol
				});
			} else {
				// Action 1 - Stake both
				cpu_v = (cpu_diff / 10000).toFixed(4);
				net_v = (net_diff / 10000).toFixed(4);
				console.log('NET: ', net_v, 'CPU: ', cpu_v);
				tr['delegatebw']({
					from: account,
					receiver: account,
					stake_net_quantity: net_v + ' ' + symbol,
					stake_cpu_quantity: cpu_v + ' ' + symbol,
					transfer: 0
				});
			}
		});
	}

	// async stake(account, amount, symbol) {
	// 	const accountInfo = await this.eos['getAccount'](account);
	// 	const current_stake = accountInfo['cpu_weight'] + accountInfo['net_weight'];
	// 	const new_total = current_stake + amount;
	// 	const new_cpu = new_total * 0.75;
	// 	const new_net = new_total * 0.25;
	// 	const cpu_diff = new_cpu - accountInfo['cpu_weight'];
	// 	const net_diff = new_net - accountInfo['net_weight'];
	// 	if (amount > 2) {
	// 		return this.changebw(account, cpu_diff, net_diff, symbol);
	// 	} else {
	// 		return null;
	// 	}
	// }

	// async unstake(account, amount, symbol) {
	// 	const accountInfo = await this.eos['getAccount'](account);
	//
	// 	const current_stake = accountInfo['cpu_weight'] + accountInfo['net_weight'];
	//
	// 	console.log(accountInfo);
	// 	console.log(current_stake);
	// 	console.log(amount);
	// 	console.log(current_stake - amount);
	//
	// 	if (current_stake - amount >= 10000) {
	// 		const n_ratio = accountInfo['net_weight'] / current_stake;
	// 		const c_ratio = accountInfo['cpu_weight'] / current_stake;
	// 		const net = ((amount * n_ratio) / 10000).toFixed(4);
	// 		const cpu = ((amount * c_ratio) / 10000).toFixed(4);
	// 		console.log('CPU: ', cpu + ' ' + symbol);
	// 		console.log('NET: ', net + ' ' + symbol);
	// 		return this.eos['undelegatebw']({
	// 			from: account,
	// 			receiver: account,
	// 			unstake_net_quantity: net + ' ' + symbol,
	// 			unstake_cpu_quantity: cpu + ' ' + symbol
	// 		});
	// 	} else {
	// 		return null;
	// 	}
	// }

}
