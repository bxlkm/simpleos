import {Component, NgZone, OnInit, ViewChild, ElementRef} from '@angular/core';
import {EOSJSService} from '../services/eosjs.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../services/accounts.service';
import {Router} from '@angular/router';
import {ClrWizard} from '@clr/angular';
import {NetworkService} from '../services/network.service';
import {CryptoService} from '../services/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {RamService} from '../services/ram.service';
import {HttpClient} from '@angular/common/http';
import {VotingService} from '../services/voting.service';

@Component({
	selector: 'app-landing',
	templateUrl: './landing.component.html',
	styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {

	@ViewChild('wizardexists') exisitswizard: ClrWizard;
	@ViewChild('wizardnew') wizardnew: ClrWizard;
	@ViewChild('wizardkeys') wizardkeys: ClrWizard;
	@ViewChild('customImportBK') customImportBK: ElementRef;
	lottieConfig: Object;
	anim: any;
	busy: boolean;
	existingWallet: boolean;
	exodusWallet: boolean;
	newWallet: boolean;
	newKeys: boolean;
	importBKP: boolean;
	endpointModal: boolean;
	// endPoint = 'http://api.eosrio.io';
	accountname = '';
	accountname_err = '';
	accountname_valid = false;
	ownerpk = '';
	ownerpk2 = '';
	ownerpub = '';
	ownerpub2 = '';
	activepk = '';
	activepub = '';
	newAccountPayload = '';
	agreeKeys = false;
	agreeKeys2 = false;
	check: boolean;
	publicEOS: string;
	checkerr: string;
	errormsg: string;
	accounts: any[];
	dropReady: boolean;
	passmatch: boolean;
	passexodusmatch: boolean;
	agree: boolean;
	agree2: boolean;
	generating = false;
	generating2 = false;

	passform: FormGroup;
	passformexodus: FormGroup;
	pvtform: FormGroup;
	importForm: FormGroup;
	refundForm: FormGroup;

	pk: string;
	publickey: string;
	pin: string;
	pinexodus: string;
	lockscreen: boolean;
	lockscreen2: boolean;
	importedAccounts: any[];
	exodusValid = false;
	// endpoint = 'http://api.eosrio.io';
	endpoint: string;
	payloadValid = false;
	generated = false;
	generated2 = false;
	config: ToasterConfig;
	verifyPanel = false;
	choosedFil: string;
	disableIm: boolean;
	infile: any;
	total_amount: number;
	memo: string;
	openTX = LandingComponent.openTXID;
	openGit = LandingComponent.openGithub;
	openFaq = LandingComponent.openFAQ;
	busy2 = false;
	busyActivekey = false;

	relayMethod = false;
	requestValid = false;
	requestId = '';
	requestError = '';
	noPIN = true;
	apierror = '';

	static parseEOS(tk_string) {
		if (tk_string.split(' ')[1] === 'EOS') {
			return parseFloat(tk_string.split(' ')[0]);
		} else {
			return 0;
		}
	}

	static openTXID(value) {
		window['shell']['openExternal']('https://www.bloks.io/account/' + value);
	}

	static openGithub() {
		window['shell']['openExternal']('https://github.com/eosrio/eosriosignup');
	}

	static openFAQ() {
		window['shell']['openExternal']('https://github.com/eosrio/eosriosignup');
	}

	static resetApp() {
		if (window['remote']) {
			window['remote']['app']['relaunch']();
			window['remote']['app'].exit(0);
		}
	}

	constructor(public eos: EOSJSService,
				private voting: VotingService,
				private crypto: CryptoService,
				private fb: FormBuilder,
				public aService: AccountsService,
				private toaster: ToasterService,
				public network: NetworkService,
				private router: Router,
				private zone: NgZone,
				public ram: RamService,
				private http: HttpClient) {

		this.busy = true;
		this.existingWallet = false;
		this.exodusWallet = false;
		this.dropReady = false;
		this.newWallet = false;
		this.check = false;
		this.passmatch = true;
		this.passexodusmatch = true;
		this.agree = false;
		this.agree2 = false;
		this.lockscreen = false;
		this.lockscreen2 = false;
		this.importBKP = false;
		this.endpointModal = false;
		this.disableIm = false;
		this.accounts = [];
		this.importedAccounts = [];
		this.checkerr = '';
		this.errormsg = '';
		this.endpoint = '';
		this.total_amount = 1;
		this.memo = '';
		this.busyActivekey = false;
		this.lottieConfig = {
			path: 'assets/logoanim.json',
			autoplay: false,
			loop: false
		};
		this.network.networkingReady.asObservable().subscribe((status) => {
			this.busy = !status;
		});
		this.publicEOS = '';
		this.passform = this.fb.group({
			matchingPassword: this.fb.group({
				pass1: ['', [Validators.required, Validators.minLength(10)]],
				pass2: ['', [Validators.required, Validators.minLength(10)]]
			})
		});
		this.pvtform = this.fb.group({
			private_key: ['', Validators.required]
		});
		this.passformexodus = this.fb.group({
			matchingPassword: this.fb.group({
				pass1: ['', [Validators.required, Validators.minLength(10)]],
				pass2: ['', [Validators.required, Validators.minLength(10)]]
			})
		});
		this.importForm = this.fb.group({
			pass: [''],
			customImportBK: ['', Validators.required],
		});
		this.refundForm = this.fb.group({
			account: ['', Validators.required],
			memo: ['', Validators.required]
		});
	}

	cc(text, title, body) {
		window['navigator']['clipboard']['writeText'](text).then(() => {
			this.showToast('success', title + ' copied to clipboard!', body);
		}).catch(() => {
			this.showToast('error', 'Clipboard didn\'t work!', 'Please try other way.');
		});
	}

	checkPIN() {
		this.noPIN = localStorage.getItem('simpleos-hash') === null;
	}


	resetAndClose() {
		this.wizardnew.reset();
		this.wizardnew.close();
	}

	private showToast(type: string, title: string, body: string) {
		this.config = new ToasterConfig({
			positionClass: 'toast-top-right',
			timeout: 10000,
			newestOnTop: true,
			tapToDismiss: true,
			preventDuplicates: false,
			animation: 'slideDown',
			limit: 1,
		});
		const toast: Toast = {
			type: type,
			title: title,
			body: body,
			timeout: 10000,
			showCloseButton: true,
			bodyOutputType: BodyOutputType.TrustedHtml,
		};
		this.toaster.popAsync(toast);
	}

	ngOnInit() {
		this.getCurrentEndpoint();
		setTimeout(() => {
			this.anim.pause();
		}, 10);

		setTimeout(() => {
			this.anim.play();
		}, 900);
		this.checkPIN();
	}


	getCurrentEndpoint() {
		if (this.network.activeChain.lastNode !== '') {
			this.endpoint = this.network.activeChain.lastNode;
		} else {
			this.endpoint = this.network.activeChain['firstApi'];
		}
	}


	parseSYMBOL(tk_string) {
		if (tk_string.split(' ')[1] === this.network.activeChain['symbol']) {
			return parseFloat(tk_string.split(' ')[0]);
		} else {
			return 0;
		}
	}

	changeChain(event) {
		this.exisitswizard.reset();
		this.network.changeChain(event);
		this.getCurrentEndpoint();
	}

	setEndPoint(ep) {
		if (ep !== this.endpoint) {
			this.endpoint = ep;
			this.customConnect();
			this.endpointModal = false;
		}
	}

	setPin() {
		this.crypto.createPIN(this.pin);
	}

	validateExchangeMemo(account: string, memo: string) {
		if (this.network.activeChain['exchanges']) {
			if (this.network.activeChain['exchanges'][account]) {
				const ex = this.network.activeChain['exchanges'][account];

				// check memo size
				if (ex['memo_size']) {
					if (memo.length !== ex['memo_size']) {
						return false;
					}
				}

				// check memo pattern
				if (ex['pattern']) {
					const regex = new RegExp(ex['pattern']);
					return regex.test(memo);
				}

				return true;

			} else {
				return true;
			}
		} else {
			return true;
		}
	}

	verifyAccountName(next) {
		try {
			this.accountname_valid = false;
			const res = this.eos.checkAccountName(this.accountname.toLowerCase());
			const regexName = new RegExp('^([a-z]|[1-5])+$');
			if (res !== 0) {
				if (this.accountname.length === 12 && regexName.test(this.accountname.toLowerCase())) {
					this.eos.getAccountInfo(this.accountname.toLowerCase()).then(() => {
						// this.eos['getAccount'](this.accountname, (err, data) => {
						//   console.log(err, data);
						this.accountname_err = 'This account name is not available. Please try another.';
						this.accountname_valid = false;
					}).catch(() => {
						this.accountname_valid = true;
						this.accountname_err = '';
						if (next) {
							this.wizardnew.next();
						}
					});
				} else {
					this.accountname_err = 'The account name must have exactly 12 characters. a-z, 1-5';
				}
			}
		} catch (e) {
			this.accountname_err = e.message;
		}
	}

	generateKeys() {
		this.generating = true;
		setTimeout(() => {
			this.eos.ecc.initialize().then(() => {
				this.eos.ecc['randomKey'](64).then((privateKey) => {
					this.ownerpk = privateKey;
					this.ownerpub = this.eos.ecc['privateToPublic'](this.ownerpk);
					this.eos.ecc['randomKey'](64).then((privateKey2) => {
						this.activepk = privateKey2;
						this.activepub = this.eos.ecc['privateToPublic'](this.activepk);
						this.generating = false;
						this.generated = true;
					});
				});
			});
		}, 100);
	}


	generateNKeys() {
		this.generating2 = true;
		setTimeout(() => {
			this.eos.ecc.initialize().then(() => {
				this.eos.ecc['randomKey'](64).then((privateKey) => {
					this.ownerpk2 = privateKey;
					this.ownerpub2 = this.eos.ecc['privateToPublic'](this.ownerpk2);
					this.generating2 = false;
					this.generated2 = true;
				});
			});
		}, 100);
	}

	makePayload() {
		if (this.eos.ecc['isValidPublic'](this.ownerpub) && this.eos.ecc['isValidPublic'](this.activepub)) {
			console.log('Generating account payload');
			this.newAccountPayload = btoa(JSON.stringify({
				n: this.accountname.toLowerCase(),
				o: this.ownerpub,
				a: this.activepub,
				t: new Date().getTime()
			}));
			this.payloadValid = true;
		} else {
			alert('Invalid public key!');
			this.newAccountPayload = 'Invalid public key! Please go back and fix it!';
			this.payloadValid = false;
			this.wizardnew.navService.previous();
		}
	}

	makeRelayRequest() {
		const reqData = {
			name: this.accountname.toLowerCase(),
			active: this.activepub,
			owner: this.ownerpub,
			refund_account: this.refundForm.get('account').value,
			refund_memo: this.refundForm.get('memo').value
		};
		if (this.validateExchangeMemo(reqData.refund_account, reqData.refund_memo)) {
			this.http.post('https://hapi.eosrio.io/account_creation_api/request_account', reqData).subscribe((data) => {
				console.log(data);
				if (data['status'] === 'OK') {
					this.requestId = data['requestId'];
					this.requestError = '';
					this.requestValid = true;
				} else {
					this.requestValid = false;
					this.requestError = data['msg'];
				}
			});
		} else {
			this.requestError = 'Invalid memo format';
			this.requestValid = false;
		}
	}

	makeMemo() {
		this.memo = this.accountname.toLowerCase() + '-' + this.ownerpub + '-' + this.activepub;
	}

	retryConn() {
		this.network.connect(true);
	}

	customConnect() {
		this.network.startup(this.endpoint);
	}

	getConstitution() {
		if (this.network.activeChain['name'] === 'EOS MAINNET') {
			this.eos.getConstitution();
		}
	}

	handleAnimation(anim: any) {
		this.anim = anim;
		this.anim['setSpeed'](0.8);
	}

	passCompare() {
		if (this.passform.value.matchingPassword.pass1 && this.passform.value.matchingPassword.pass2) {
			if (this.passform.value.matchingPassword.pass1 === this.passform.value.matchingPassword.pass2) {
				this.passform['controls'].matchingPassword['controls']['pass2'].setErrors(null);
				this.passmatch = true;
			} else {
				this.passform['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
				this.passmatch = false;
			}
		}
	}

	passExodusCompare() {
		if (this.passformexodus.value.matchingPassword.pass1 && this.passformexodus.value.matchingPassword.pass2) {
			if (this.passformexodus.value.matchingPassword.pass1 === this.passformexodus.value.matchingPassword.pass2) {
				this.passformexodus['controls'].matchingPassword['controls']['pass2'].setErrors(null);
				this.passexodusmatch = true;
			} else {
				this.passformexodus['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
				this.passexodusmatch = false;
			}
		}
	}

	preImportCredentials(EOS) {
		if (EOS) {
			if (!this.noPIN) {
				this.importCredentials();
			}
		} else {
			if (!this.noPIN && this.aService.activeChain.name !== 'EOS MAINNET') {
				this.importCredentials();
			}
		}
	}

	importCredentials() {
		const pubk = this.publicEOS;
		const pass1 = this.passform.value.matchingPassword.pass1;
		const pass2 = this.passform.value.matchingPassword.pass2;

		if (pass1 === pass2) {
			this.crypto.initKeys(pubk, pass1).then(() => {

				let pvk = this.pvtform.value.private_key;

				this.crypto.encryptAndStore(pvk, pubk).then(() => {

					pvk = '';

					this.aService.importAccounts(this.importedAccounts).then((data: any[]) => {

						if (data.length > 0) {

							this.crypto.decryptKeys(pubk).then(() => {

								this.router.navigate(['dashboard', 'vote']).then(() => {

								}).catch((err) => {
									console.log(err);
								});
								if (this.lockscreen) {
									this.setPin();
								}
							}).catch((error) => {
								console.log('Error', error);
							});
						}
					});
				}).catch((err) => {
					console.log(err);
				});
			});
		}
	}

	verifyPrivateKey(input) {
		if (input !== '') {
			this.busyActivekey = true;
			this.eos.checkPvtKey(input).then((results) => {
				this.publicEOS = results.publicKey;
				this.importedAccounts = [];
				this.importedAccounts = [...results.foundAccounts];
				this.importedAccounts.forEach((item) => {
					if (item['refund_request']) {
						const tempDate = item['refund_request']['request_time'] + '.000Z';
						const refundTime = new Date(tempDate).getTime() + (72 * 60 * 60 * 1000);
						const now = new Date().getTime();
						if (now > refundTime) {
							this.eos.claimRefunds(item.account_name, input).then((tx) => {
								console.log(tx);
							});
						} else {
							console.log('Refund not ready!');
						}
					}
				});
				this.pvtform.controls['private_key'].setErrors(null);
				this.zone.run(() => {
					this.exisitswizard.forceNext();
					this.errormsg = '';
					this.apierror = '';
				});
			}).catch((e) => {
				this.zone.run(() => {
					this.dropReady = true;
					this.exodusValid = false;
					this.pvtform.controls['private_key'].setErrors({'incorrect': true});
					this.importedAccounts = [];
					if (e.message.includes('Invalid checksum')) {
						this.errormsg = 'invalid private key';
					}
					if (e.message === 'no_account') {
						this.errormsg = 'No account associated with this private key';
					}
					if (e.message === 'non_active') {
						this.errormsg = 'This is not the active key. Please import the active key.';
					}
					if (e.message === 'api_arror') {
						this.apierror = 'API Unavailable, please try again with another endpoint.';
					}
				});
			});
		}
	}

	doCancel(): void {
		this.exisitswizard.close();
	}

	// Verify public key - step 1
	checkAccount() {
		if (this.eos.ready) {
			this.check = true;
			this.accounts = [];
			this.eos.loadPublicKey(this.publicEOS.trim()).then((account_data: any) => {
				console.log(account_data);
				this.processCheckAccount(account_data.foundAccounts);
			}).catch((err) => {
				console.log('ERROR', err.message);
				console.log('ACCOUNTS', err.accounts);
				this.checkerr = err;
				this.processCheckAccount(err.accounts);
			});
		}
	}

	// Verify public key - step 2
	processCheckAccount(foundAccounts) {
		foundAccounts.forEach((acc) => {
			// Parse tokens and calculate balance with system token
			if (acc['tokens']) {
				this.processTokens(acc);
			} else {
				this.eos.getTokens(acc['account_name']).then((tokens) => {
					acc['tokens'] = tokens;
					this.processTokens(acc);
				}).catch((err) => {
					console.log(err);
				});
			}
		});
		this.checkerr = '';
	}

	// Verify public key - step 3
	processTokens(acc) {
		let balance = 0;
		acc['tokens'].forEach((tk) => {
			balance += this.parseSYMBOL(tk);
		});
		// Add stake balance
		balance += this.parseSYMBOL(acc['total_resources']['cpu_weight']);
		balance += this.parseSYMBOL(acc['total_resources']['net_weight']);
		const accData = {
			name: acc['account_name'],
			full_balance: Math.round((balance) * 10000) / 10000
		};
		this.accounts.push(accData);
	}

	inputIMClick() {
		this.customImportBK.nativeElement.click();
	}

	importCheckBK(a) {
		this.infile = a.target.files[0];
		console.log(this.infile);
		const name = this.infile.name;
		if (name.split('.')[1] !== 'bkp') {
			this.showToast('error', 'Wrong file!', '');
			this.infile = '';
			return false;
		}
		this.choosedFil = name;
		console.log(this.choosedFil);
	}

	importBK() {
		this.disableIm = true;
		this.busy2 = true;
		if (this.infile && this.infile !== '') {
			window['filesystem']['readFile'](this.infile.path, 'utf-8', (err, data) => {
				if (!err) {
					const pass = this.importForm.value.pass;
					let arrLS = null;
					let decrypt = null;
					try {
						console.log('trying to parse json...');
						arrLS = JSON.parse(data);
					} catch (e) {
						// backup encrypted, password required
						if (pass !== '') {
							decrypt = this.crypto.decryptBKP(data, pass);
							try {
								arrLS = JSON.parse(decrypt);
							} catch (e) {
								this.showToast('error', 'Wrong password, please try again!', '');
								console.log('wrong file');
							}
						} else {
							this.showToast('error', 'This backup file is encrypted, please provide a password!', '');
						}
					}
					if (arrLS) {
						arrLS.forEach(function (d) {
							localStorage.setItem(d['key'], d['value']);
						});
						this.showToast('success', 'Imported with success!', 'Application will restart... wait for it!');
						LandingComponent.resetApp();
						this.choosedFil = '';
						this.disableIm = false;
						this.busy2 = false;
						this.importBKP = false;
					} else {
						this.choosedFil = '';
						this.disableIm = false;
						this.busy2 = false;
					}

				} else {
					this.showToast('error', 'Something went wrong, please try again or contact our support!', '');
					console.log('wrong entry');
				}
			});
		} else {
			this.showToast('error', 'Choose your backup file', '');
			this.choosedFil = '';
			this.disableIm = false;
			this.busy2 = false;
		}
	}
}
