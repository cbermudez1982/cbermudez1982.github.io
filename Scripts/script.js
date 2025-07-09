import { ethers } from 'https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js';

const provider = new ethers.BrowserProvider(window.ethereum);
let signer;

const CONTRACT_ADDRESS = "0xe30Ad4daFB933547Fe3e68ea4e3dB8416CDEEf82";
const TOKEN_A = "0xf367150C56b9c8C14db60914C82D1b278cfA7A6D";
const TOKEN_B = "0x1Fd59a58510686a2d6029A8D27F66Fdc68360ed1";

const abi = [
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] memory)",
  "function approve(address spender, uint amount) external returns (bool)",
  "function getPrice(address tokenA, address tokenB) external view returns (uint256 price)",
  "function removeLiquidity(address tokenA,address tokenB,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) external returns (uint256 amountA, uint256 amountB)",
  "function balanceOf(address account) external view returns (uint256)"
];

// UI elements
const connectBtn = document.getElementById("connectBtn");
const addLiqBtn = document.getElementById("addLiqBtn");
const swapBtn = document.getElementById("swapBtn");
const remLiqBtn = document.getElementById("remLiqBtn");
const liqStatus = document.getElementById("liqStatus");
const swapStatus = document.getElementById("swapStatus");
const remLiqStatus = document.getElementById("remLiqStatus");

const swapOrderBtn = document.getElementById("swapOrderBtn");
const priceDisplay = document.getElementById("priceDisplay");
const liqDisplay = document.getElementById("liqDisplay");
const tokenADisplay = document.getElementById("tokenA");
const tokenBDisplay = document.getElementById("tokenB");

let currentTokenA = TOKEN_A;
let currentTokenB = TOKEN_B;

// Connect wallet
connectBtn.onclick = async () => {
  try {
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    const address = await signer.getAddress();
    document.getElementById("walletAddress").innerText = `✅ Conectado: ${address}`;
    await updateUI();
  } catch (e) {
    alert("Error connecting wallet: " + (e.message || e));
  }
};

async function getContract() {
  signer = signer || await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
}

async function getTokenContract(tokenAddress) {
  const erc20Abi = [
    "function approve(address spender, uint amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)"
  ];
  return new ethers.Contract(tokenAddress, erc20Abi, signer);
}

async function updateUI() {
  tokenADisplay.innerText = currentTokenA;
  tokenBDisplay.innerText = currentTokenB;

  if (!signer) {
    priceDisplay.innerText = "-";
    liqDisplay.innerText = "-";
    return;
  }

  try {
    const contract = await getContract();
    const price = await contract.getPrice(currentTokenA, currentTokenB);
    const address = await signer.getAddress();
    const liquidity = await contract.balanceOf(address);

    // Formatear decimales asumiendo 18 decimales
    const priceFormatted = ethers.formatUnits(price, 18);
    const liqFormatted = ethers.formatUnits(liquidity, 18);

    priceDisplay.innerText = priceFormatted;
    liqDisplay.innerText = liqFormatted;
  } catch (e) {
    priceDisplay.innerText = "-";
    liqDisplay.innerText = "-";
    console.error("Error updating UI:", e);
  }
}

// Swap token order button
swapOrderBtn.onclick = () => {
  [currentTokenA, currentTokenB] = [currentTokenB, currentTokenA];
  updateUI();
};

// Add liquidity
addLiqBtn.onclick = async () => {
  if (!signer) {
    alert("Conecte su wallet primero.");
    return;
  }
  liqStatus.innerText = "";

  try {
    const amountA = document.getElementById("liqAmountA").value;
    const amountB = document.getElementById("liqAmountB").value;

    if (!amountA || !amountB || Number(amountA) <= 0 || Number(amountB) <= 0) {
      alert("Por favor, ingrese cantidades válidas para ambos tokens.");
      return;
    }

    const contract = await getContract();
    const tokenA = await getTokenContract(currentTokenA);
    const tokenB = await getTokenContract(currentTokenB);

    const amountADesired = ethers.parseUnits(amountA, 18);
    const amountBDesired = ethers.parseUnits(amountB, 18);
    const deadline = Math.floor(Date.now() / 1000) + 600;

    liqStatus.innerText = "Aprobando Token A...";
    let tx = await tokenA.approve(CONTRACT_ADDRESS, amountADesired);
    await tx.wait();

    liqStatus.innerText = "Aprobando Token B...";
    tx = await tokenB.approve(CONTRACT_ADDRESS, amountBDesired);
    await tx.wait();

    liqStatus.innerText = "Añadiendo liquidez...";
    tx = await contract.addLiquidity(
      currentTokenA,
      currentTokenB,
      amountADesired,
      amountBDesired,
      0,
      0,
      await signer.getAddress(),
      deadline
    );
    await tx.wait();

    liqStatus.innerText = "✅ Liquidez añadida correctamente.";
    await updateUI();
  } catch (e) {
    console.error(e);
    liqStatus.innerText = "❌ Error: " + (e.reason || e.message || e);
  }
};

// Swap tokens
swapBtn.onclick = async () => {
  if (!signer) {
    alert("Conecte su wallet primero.");
    return;
  }
  swapStatus.innerText = "";

  try {
    const amountIn = document.getElementById("swapAmountIn").value;
    if (!amountIn || Number(amountIn) <= 0) {
      alert("Ingrese una cantidad válida para el swap.");
      return;
    }

    const contract = await getContract();
    const tokenIn = await getTokenContract(currentTokenA);
    const amount = ethers.parseUnits(amountIn, 18);
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const address = await signer.getAddress();

    swapStatus.innerText = "Aprobando token A...";
    let tx = await tokenIn.approve(CONTRACT_ADDRESS, amount);
    await tx.wait();

    swapStatus.innerText = "Realizando swap...";
    tx = await contract.swapExactTokensForTokens(
      amount,
      0,
      [currentTokenA, currentTokenB],
      address,
      deadline
    );
    await tx.wait();

    swapStatus.innerText = "✅ Swap finalizado.";
    await updateUI();
  } catch (e) {
    console.error(e);
    swapStatus.innerText = "❌ Error: " + (e.reason || e.message || e);
  }
};

// Remove liquidity
remLiqBtn.onclick = async () => {
  if (!signer) {
    alert("Conecte su wallet primero.");
    return;
  }
  remLiqStatus.innerText = "";

  try {
    const liquidityAmount = document.getElementById("liqAmountRemove").value;
    if (!liquidityAmount || Number(liquidityAmount) <= 0) {
      alert("Ingrese una cantidad válida de tokens LP para remover.");
      return;
    }

    const contract = await getContract();
    const liquidity = ethers.parseUnits(liquidityAmount, 18);
    const deadline = Math.floor(Date.now() / 1000) + 600;

    // LP tokens approval (LP tokens are the SimpleSwap ERC20 tokens)
    const lpToken = await getTokenContract(CONTRACT_ADDRESS);
    remLiqStatus.innerText = "Aprobando tokens LP...";
    let tx = await lpToken.approve(CONTRACT_ADDRESS, liquidity);
    await tx.wait();

    remLiqStatus.innerText = "Removiendo liquidez...";
    tx = await contract.removeLiquidity(
      currentTokenA,
      currentTokenB,
      liquidity,
      0,
      0,
      await signer.getAddress(),
      deadline
    );
    await tx.wait();

    remLiqStatus.innerText = "✅ Liquidez removida correctamente.";
    await updateUI();
  } catch (e) {
    console.error(e);
    remLiqStatus.innerText = "❌ Error: " + (e.reason || e.message || e);
  }
};

// Actualiza UI al cargar la página
updateUI();
