import { toJson } from './serializer';
import { BIP44AddressKeyDeriver } from '@metamask/key-tree';
import {
  ec,
  json,
  hash,
  num,
  TypedData,
  typedData,
  constants,
  encode,
  CallData,
  Provider,
  Account,
  Call,
  DeployContractResponse,
  InvokeFunctionResponse,
  EstimateFee,
  RawCalldata,
  CallContractResponse,
  ProviderOptions,
  GetTransactionResponse,
  Invocations,
  validateAndParseAddress as _validateAndParseAddress,
  DeclareContractPayload,
  DeclareContractResponse,
  Signer,
  Signature,
  stark,
  Abi,
  UniversalDetails,
  DeclareSignerDetails,
  DeployAccountSignerDetails,
  InvocationsSignerDetails,
  ProviderInterface,
  CairoVersion,
  GetTransactionReceiptResponse,
} from 'starknet';
import { Network, SnapState, Transaction, TransactionType } from '../types/snapState';
import { ACCOUNT_CLASS_HASH_V0, PROXY_CONTRACT_HASH, TRANSFER_SELECTOR_HEX } from './constants';
import { getAddressKey } from './keyPair';
import {
  getAccount,
  getAccounts,
  getRPCUrl,
  getTransactionFromVoyagerUrl,
  getTransactionsFromVoyagerUrl,
  getVoyagerCredentials,
} from './snapUtils';
import { logger } from './logger';
import { RpcV4GetTransactionReceiptResponse } from '../types/snapApi';

export const getCallDataArray = (callDataStr: string): string[] => {
  return (callDataStr ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
};

export const getProvider = (network: Network): ProviderInterface => {
  let providerParam: ProviderOptions = {};
  providerParam = {
    nodeUrl: getRPCUrl(network.chainId),
  };
  return new Provider(providerParam);
};

export const callContract = async (
  network: Network,
  contractAddress: string,
  contractFuncName: string,
  contractCallData: RawCalldata = [],
): Promise<CallContractResponse> => {
  const provider = getProvider(network);
  return provider.callContract(
    {
      contractAddress,
      entrypoint: contractFuncName,
      calldata: contractCallData,
    },
    'latest',
  );
};

export const declareContract = async (
  network: Network,
  senderAddress: string,
  privateKey: string | Uint8Array,
  contractPayload: DeclareContractPayload,
  invocationsDetails?: UniversalDetails,
): Promise<DeclareContractResponse> => {
  const provider = getProvider(network);
  const account = new Account(provider, senderAddress, privateKey, '0');
  return account.declare(contractPayload, { ...invocationsDetails, skipValidate: false, blockIdentifier: 'latest' });
};

export const estimateFee = async (
  network: Network,
  senderAddress: string,
  privateKey: string | Uint8Array,
  txnInvocation: Call | Call[],
  invocationsDetails?: UniversalDetails,
): Promise<EstimateFee> => {
  const provider = getProvider(network);
  const account = new Account(provider, senderAddress, privateKey, '0');
  return account.estimateInvokeFee(txnInvocation, {
    ...invocationsDetails,
    skipValidate: false,
    blockIdentifier: 'latest',
  });
};

export const waitForTransaction = async (
  network: Network,
  senderAddress: string,
  privateKey: string | Uint8Array,
  txnHash: num.BigNumberish,
  cairoVersion?: CairoVersion,
): Promise<GetTransactionReceiptResponse> => {
  const provider = getProvider(network);
  const account = new Account(provider, senderAddress, privateKey, cairoVersion ?? '0');
  return account.waitForTransaction(txnHash);
};

export const estimateFeeBulk = async (
  network: Network,
  senderAddress: string,
  privateKey: string | Uint8Array,
  txnInvocation: Invocations,
  invocationsDetails?: UniversalDetails,
): Promise<EstimateFee[]> => {
  const provider = getProvider(network);
  const account = new Account(provider, senderAddress, privateKey, '0');
  return account.estimateFeeBulk(txnInvocation, {
    ...invocationsDetails,
    skipValidate: false,
    blockIdentifier: 'latest',
  });
};

export const executeTxn = async (
  network: Network,
  senderAddress: string,
  privateKey: string | Uint8Array,
  txnInvocation: Call | Call[],
  abis?: Abi[],
  invocationsDetails?: UniversalDetails,
): Promise<InvokeFunctionResponse> => {
  const provider = getProvider(network);
  const account = new Account(provider, senderAddress, privateKey, '0');
  return account.execute(txnInvocation, abis, {
    ...invocationsDetails,
    skipValidate: false,
    blockIdentifier: 'latest',
  });
};

export const deployAccount = async (
  network: Network,
  contractAddress: string,
  contractCallData: RawCalldata,
  addressSalt: num.BigNumberish,
  privateKey: string | Uint8Array,
  invocationsDetails?: UniversalDetails,
): Promise<DeployContractResponse> => {
  const provider = getProvider(network);
  const account = new Account(provider, contractAddress, privateKey, '0');
  const deployAccountPayload = {
    classHash: PROXY_CONTRACT_HASH,
    contractAddress: contractAddress,
    constructorCalldata: contractCallData,
    addressSalt,
  };
  return account.deployAccount(deployAccountPayload, {
    ...invocationsDetails,
    skipValidate: false,
    blockIdentifier: 'latest',
  });
};

export const estimateAccountDeployFee = async (
  network: Network,
  contractAddress: string,
  contractCallData: RawCalldata,
  addressSalt: num.BigNumberish,
  privateKey: string | Uint8Array,
  invocationsDetails?: UniversalDetails,
): Promise<EstimateFee> => {
  const provider = getProvider(network);
  const account = new Account(provider, contractAddress, privateKey, '0');
  const deployAccountPayload = {
    classHash: PROXY_CONTRACT_HASH,
    contractAddress: contractAddress,
    constructorCalldata: contractCallData,
    addressSalt,
  };
  return account.estimateAccountDeployFee(deployAccountPayload, {
    ...invocationsDetails,
    skipValidate: false,
    blockIdentifier: 'latest',
  });
};

export const getSigner = async (userAccAddress: string, network: Network): Promise<string> => {
  const resp = await callContract(network, userAccAddress, 'getSigner');
  return resp[0];
};

export const getTransactionStatus = async (transactionHash: num.BigNumberish, network: Network) => {
  const provider = getProvider(network);
  const receipt = (await provider.getTransactionReceipt(transactionHash)) as RpcV4GetTransactionReceiptResponse;
  return {
    executionStatus: receipt.execution_status,
    finalityStatus: receipt.finality_status,
  };
};

export const getTransaction = async (transactionHash: num.BigNumberish, network: Network) => {
  const provider = getProvider(network);
  return provider.getTransaction(transactionHash);
};

export const getTransactionsFromVoyager = async (
  toAddress: num.BigNumberish,
  pageSize: number,
  pageNum: number,
  network: Network,
) => {
  let toQueryStr = '';
  if (toAddress) {
    toQueryStr = `to=${num.toHex(num.toBigInt(toAddress))}&`;
  }
  // "ps" only effective on value: 10, 25, 50 as what's currently available in Voyager page
  return getData(
    `${getTransactionsFromVoyagerUrl(network)}?${toQueryStr}ps=${pageSize}&p=${pageNum}`,
    getVoyagerCredentials(),
  );
};

export const getTransactionFromVoyager = async (transactionHash: num.BigNumberish, network: Network) => {
  const txHashHex = num.toHex(num.toBigInt(transactionHash));
  return getData(`${getTransactionFromVoyagerUrl(network)}/${txHashHex}`, getVoyagerCredentials());
};

const getTransactionsFromVoyagerHelper = async (
  toAddress: num.BigNumberish,
  pageSize: number,
  minTimestamp: number, // in ms
  withDeployTxn: boolean,
  network: Network,
) => {
  let txns = [];
  let i = 1;
  let maxPage = i;
  do {
    try {
      const { items, lastPage } = await getTransactionsFromVoyager(toAddress, pageSize, i, network);
      txns.push(...items);
      maxPage = lastPage;
    } catch (err) {
      logger.error(`getTransactionsFromVoyagerHelper: error received from getTransactionsFromVoyager: ${err}`);
    }
    i++;
  } while (i <= maxPage && txns[txns.length - 1]?.timestamp * 1000 >= minTimestamp);
  logger.log(
    `getTransactionsFromVoyagerHelper: minTimestamp = ${minTimestamp}, i = ${i}, maxPage = ${maxPage}, total = ${txns.length}`,
  );

  let deployTxns = [];
  if (withDeployTxn) {
    if (i <= maxPage) {
      // means lastPage not fetched
      try {
        const { items: lastPageTxns } = await getTransactionsFromVoyager(toAddress, pageSize, maxPage, network);
        deployTxns = lastPageTxns.filter(
          (txn) =>
            txn.type.toLowerCase() === TransactionType.DEPLOY.toLowerCase() ||
            txn.type.toLowerCase() === TransactionType.DEPLOY_ACCOUNT.toLowerCase(),
        );
        txns = [...txns, ...deployTxns];
      } catch (err) {
        logger.error(
          `getTransactionsFromVoyagerHelper: error received from getTransactionsFromVoyager at last page: ${err}`,
        );
      }
    } else {
      deployTxns = txns.filter(
        (txn) =>
          txn.type.toLowerCase() === TransactionType.DEPLOY.toLowerCase() ||
          txn.type.toLowerCase() === TransactionType.DEPLOY_ACCOUNT.toLowerCase(),
      );
    }
  }

  // ensure the txns comes after or at the min timestamp or its in the deploy txns
  txns = txns.filter(
    (txn) => txn.timestamp * 1000 >= minTimestamp || deployTxns.find((deployTxn) => deployTxn.hash === txn.hash),
  );

  return {
    txns,
    deployTxns,
  };
};

export const getMassagedTransactions = async (
  toAddress: num.BigNumberish,
  contractAddress: num.BigNumberish,
  pageSize: number,
  minTimestamp: number, // in ms
  withDeployTxn: boolean,
  network: Network,
): Promise<Transaction[]> => {
  const { txns, deployTxns } = await getTransactionsFromVoyagerHelper(
    toAddress,
    pageSize,
    minTimestamp,
    withDeployTxn,
    network,
  );

  const bigIntTransferSelectorHex = num.toBigInt(TRANSFER_SELECTOR_HEX);
  let massagedTxns = await Promise.all(
    txns.map(async (txn) => {
      let txnResp: GetTransactionResponse;
      let statusResp;
      try {
        txnResp = await getTransaction(txn.hash, network);
        statusResp = await getTransactionStatus(txn.hash, network);
        logger.log(`getMassagedTransactions: txnResp:\n${toJson(txnResp)}`);
        logger.log(`getMassagedTransactions: statusResp:\n${toJson(statusResp)}`);
      } catch (err) {
        logger.error(`getMassagedTransactions: error received from getTransaction: ${err}`);
      }

      const massagedTxn: Transaction = {
        txnHash: txnResp.transaction_hash || txn.hash,
        txnType: txn.type?.toLowerCase(),
        chainId: network.chainId,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        senderAddress: txnResp.sender_address || txnResp.contract_address || txn.contract_address || '',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        contractAddress: txnResp.calldata?.[1] || txnResp.contract_address || txn.contract_address || '',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        contractFuncName: num.toBigInt(txnResp.calldata?.[2] || '') === bigIntTransferSelectorHex ? 'transfer' : '',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        contractCallData: txnResp.calldata?.slice(6, txnResp.calldata?.length - 1) || [],
        timestamp: txn.timestamp,
        status: '', //DEPRECATION
        finalityStatus: statusResp.finalityStatus || '',
        executionStatus: statusResp.executionStatus || '',
        eventIds: [],
        failureReason: '',
      };

      return massagedTxn;
    }),
  );

  logger.log(`getMassagedTransactions: massagedTxns total = ${massagedTxns.length}`);
  logger.log(`getMassagedTransactions: massagedTxns:\n${toJson(massagedTxns)}`);

  if (contractAddress) {
    const bigIntContractAddress = num.toBigInt(contractAddress);
    massagedTxns = massagedTxns.filter(
      (massagedTxn) =>
        num.toBigInt(massagedTxn.contractAddress) === bigIntContractAddress ||
        deployTxns.find((deployTxn) => deployTxn.hash === massagedTxn.txnHash),
    );
  }

  return massagedTxns;
};

export const getData = async (url = '', headers: Record<string, string> = {}) => {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'GET', // *GET, POST, PUT, DELETE, etc.
    redirect: 'follow', // manual, *follow, error
    headers: headers,
  });
  return response.json(); // parses JSON response into native JavaScript objects
};

export const postData = async (url = '', data = {}) => {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //mode: 'cors', // no-cors, *cors, same-origin
    //cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    //credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json',
    },
    redirect: 'follow', // manual, *follow, error
    //referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: json.stringify(data), // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
};

export function getFullPublicKeyPairFromPrivateKey(privateKey: string) {
  return encode.addHexPrefix(encode.buf2hex(ec.starkCurve.getPublicKey(privateKey, false)));
}

export const getTypedDataMessageSignature = (
  privateKey: string,
  typedDataMessage: TypedData,
  signerUserAddress: string,
) => {
  const msgHash = typedData.getMessageHash(typedDataMessage, signerUserAddress);
  return ec.starkCurve.sign(msgHash, privateKey);
};

export const getSignatureBySignatureString = (signatureStr: string) => {
  return ec.starkCurve.Signature.fromDER(signatureStr);
};

export const verifyTypedDataMessageSignature = (
  fullPublicKey: string,
  typedDataMessage: TypedData,
  signerUserAddress: num.BigNumberish,
  signatureStr: string,
) => {
  const signature = getSignatureBySignatureString(signatureStr);
  const msgHash = typedData.getMessageHash(typedDataMessage, signerUserAddress);
  return ec.starkCurve.verify(signature, msgHash, fullPublicKey);
};

export const getNextAddressIndex = (chainId: string, state: SnapState, derivationPath: string) => {
  const accounts = getAccounts(state, chainId).filter(
    (acc) => acc.derivationPath === derivationPath && acc.addressIndex >= 0,
  );
  const uninitializedAccount = accounts.find((acc) => !acc.publicKey || num.toBigInt(acc.publicKey) === constants.ZERO);
  logger.log(
    `getNextAddressIndex:\nUninitialized account found from state:\n${toJson(uninitializedAccount ?? 'None')}`,
  );
  return uninitializedAccount?.addressIndex ?? accounts.length;
};

export const getAccContractAddressAndCallData = (publicKey) => {
  const callData = CallData.compile({
    implementation: ACCOUNT_CLASS_HASH_V0,
    selector: hash.getSelectorFromName('initialize'),
    calldata: CallData.compile({ signer: publicKey, guardian: '0' }),
  });
  let address = hash.calculateContractAddressFromHash(publicKey, PROXY_CONTRACT_HASH, callData, 0);
  if (address.length < 66) {
    address = address.replace('0x', '0x' + '0'.repeat(66 - address.length));
  }
  return {
    address,
    callData,
  };
};

export const getKeysFromAddress = async (
  keyDeriver,
  network: Network,
  state: SnapState,
  address: string,
  maxScan = 20,
) => {
  let addressIndex;
  const acc = getAccount(state, address, network.chainId);
  if (acc) {
    addressIndex = acc.addressIndex;
    logger.log(`getNextAddressIndex:\nFound address in state: ${addressIndex} ${address}`);
  } else {
    const bigIntAddress = num.toBigInt(address);
    for (let i = 0; i < maxScan; i++) {
      const { publicKey } = await getKeysFromAddressIndex(keyDeriver, network.chainId, state, i);
      const { address: calculatedAddress } = getAccContractAddressAndCallData(publicKey);
      if (num.toBigInt(calculatedAddress) === bigIntAddress) {
        addressIndex = i;
        logger.log(`getNextAddressIndex:\nFound address in scan: ${addressIndex} ${address}`);
        break;
      }
    }
  }

  if (!isNaN(addressIndex)) {
    return getKeysFromAddressIndex(keyDeriver, network.chainId, state, addressIndex);
  }
  logger.log(`getNextAddressIndex:\nAddress not found: ${address}`);
  throw new Error(`Address not found: ${address}`);
};

export const getKeysFromAddressIndex = async (
  keyDeriver: BIP44AddressKeyDeriver,
  chainId: string,
  state: SnapState,
  index: number = undefined,
) => {
  let addressIndex = index;
  if (isNaN(addressIndex) || addressIndex < 0) {
    addressIndex = getNextAddressIndex(chainId, state, keyDeriver.path);
    logger.log(`getKeysFromAddressIndex: addressIndex found: ${addressIndex}`);
  }

  const { addressKey, derivationPath } = await getAddressKey(keyDeriver, addressIndex);
  const starkKeyPub = ec.starkCurve.getStarkKey(addressKey);
  const starkKeyPrivate = num.toHex(addressKey);
  return {
    privateKey: starkKeyPrivate,
    publicKey: starkKeyPub,
    addressIndex,
    derivationPath,
  };
};

export const isAccountDeployed = async (network: Network, publicKey: string) => {
  let accountDeployed = true;
  try {
    const { address: signerContractAddress } = getAccContractAddressAndCallData(publicKey);
    await getSigner(signerContractAddress, network);
  } catch (err) {
    accountDeployed = false;
  }
  logger.log(`isAccountDeployed: ${accountDeployed}`);
  return accountDeployed;
};

export const addFeesFromAllTransactions = (fees: EstimateFee[]): Partial<EstimateFee> => {
  let overall_fee_bn = num.toBigInt(0);
  let suggestedMaxFee_bn = num.toBigInt(0);

  fees.forEach((fee) => {
    overall_fee_bn = overall_fee_bn + fee.overall_fee;
    suggestedMaxFee_bn = suggestedMaxFee_bn + fee.suggestedMaxFee;
  });

  return {
    overall_fee: overall_fee_bn,
    suggestedMaxFee: suggestedMaxFee_bn,
  };
};

export const _validateAndParseAddressFn = _validateAndParseAddress;
export const validateAndParseAddress = (address: num.BigNumberish, length = 63) => {
  // getting rid of 0x and 0x0 prefixes
  const trimmedAddress = address.toString().replace(/^0x0?/, '');
  if (trimmedAddress.length !== length) throw new Error(`Address ${address} has an invalid length`);
  return _validateAndParseAddressFn(address);
};

export const signTransactions = async (
  privateKey: string,
  transactions: Call[],
  transactionsDetail: InvocationsSignerDetails,
): Promise<Signature> => {
  const signer = new Signer(privateKey);
  const signatures = await signer.signTransaction(transactions, transactionsDetail);
  return stark.signatureToDecimalArray(signatures);
};

export const signDeployAccountTransaction = async (
  privateKey: string,
  transaction: DeployAccountSignerDetails,
): Promise<Signature> => {
  const signer = new Signer(privateKey);
  const signatures = await signer.signDeployAccountTransaction(transaction);
  return stark.signatureToDecimalArray(signatures);
};

export const signDeclareTransaction = async (
  privateKey: string,
  transaction: DeclareSignerDetails,
): Promise<Signature> => {
  const signer = new Signer(privateKey);
  const signatures = await signer.signDeclareTransaction(transaction);
  return stark.signatureToDecimalArray(signatures);
};

export const signMessage = async (privateKey: string, typedDataMessage: TypedData, signerUserAddress: string) => {
  const signer = new Signer(privateKey);
  const signatures = await signer.signMessage(typedDataMessage, signerUserAddress);
  return stark.signatureToDecimalArray(signatures);
};

export const getStarkNameUtil = async (network: Network, userAddress: string) => {
  const provider = getProvider(network);
  return Account.getStarkName(provider, userAddress);
};
