import { ethers } from 'https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.min.js';

const provider = new ethers.BrowserProvider(window.ethereum);
let signer;

const CONTRACT_ADDRESS = "0x38b6E4b23dd859E73d5708a940A4CA02ADE06Ce4";
const TOKEN_A = "0x1F784DeFBE370f6eC510eED68edc5eC9cD372935";
const TOKEN_B = "0x87A6480A7B77D74995302603016d88B9f54CB5a3";

const abi = [
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] memory)",
  "function approve(address spender, uint amount) external returns (bool)",
  "function getPrice(address tokenA, address tokenB) external view returns (uint256 price)",
  "function removeLiquidity(address tokenA,address tokenB,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) external returns (uint256 amountA, uint256 amountB)",
  "function balanceOf(address account) external view returns (uint256)"
];

// Elementos UI
const connectBtn = document.getElementById("connectBtn");
const addLiqBtn = document.getElementById("addLiqBtn");
const swapBtn = document.getElementById("swapBtn");
const remLiqBtn = document.getElementById("remLiqBtn");
const liqStatus = document.getElementById("liqStatus");
const swapStatus = document.getElementById("swapStatus");
const remLiqStatus = document.getElementById("remLiqStatus");


connectBtn.onclick = async () => {
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  const address = await signer.getAddress();
  document.getElementById("walletAddress").innerText = `✅ Conectado: ${address}`;
};

async function getContract() {
  signer = signer || await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
}

async function getTokenContract(tokenAddress) {
  const erc20Abi = ["function approve(address spender, uint amount) external returns (bool)"];
  return new ethers.Contract(tokenAddress, erc20Abi, signer);
}

//////////// desde aca

// Variables globales para tokens actuales
let currentTokenA = TOKEN_A;
let currentTokenB = TOKEN_B;

// Elementos UI nuevos
const swapOrderBtn = document.getElementById("swapOrderBtn");
const priceDisplay = document.getElementById("priceDisplay");
const liqDisplay = document.getElementById("liqDisplay");
const tokenADisplay = document.getElementById("tokenA");
const tokenBDisplay = document.getElementById("tokenB");

// Función para actualizar el display de tokens y precio
async function updateUI() {
  tokenADisplay.innerText = currentTokenA;
  tokenBDisplay.innerText = currentTokenB;

  try {
    const contract = await getContract();
    const price = await contract.getPrice(currentTokenA, currentTokenB);
    const liquidity = await contract.balanceOf(signer);
    // Asumimos que el precio tiene 18 decimales
    const priceFormatted = ethers.formatUnits(price, 18);
    const liqFormatted = ethers.formatUnits(liquidity, 18);
    priceDisplay.innerText = priceFormatted;
    liqDisplay.innerText = liqFormatted;

  } catch (e) {
    priceDisplay.innerText = "-";
    liqDisplay.innerText = "-";
    console.error("Error al obtener precio:", e);
  }
}

// Botón para cambiar orden
swapOrderBtn.onclick = () => {
  [currentTokenA, currentTokenB] = [currentTokenB, currentTokenA];
  updateUI();
};

// Actualizamos UI inicial
updateUI();

// En los métodos de addLiquidity y swapExactTokensForTokens,
// cambiar referencias TOKEN_A, TOKEN_B por currentTokenA, currentTokenB.

// Ejemplo en swapExactTokensForTokens:
swapBtn.onclick = async () => {
  if (!signer) {
    alert("Primero conecta tu wallet.");
    return;
  }

  swapStatus.innerText = "";

  try {
    const amountIn = document.getElementById("swapAmountIn").value;
    if (!amountIn) {
      alert("Ingresa una cantidad válida para swap.");
      return;
    }

    const contract = await getContract();
    const tokenIn = await getTokenContract(currentTokenA);
    const amount = ethers.parseUnits(amountIn, 18);
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const address = await signer.getAddress();

    swapStatus.innerText = "Aprobando Token A...";
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

    swapStatus.innerText = "✅ Swap realizado correctamente.";
  } catch (e) {
    console.error(e);
    swapStatus.innerText = "❌ Error: " + (e.reason || e.message);
  }
};

// Similar en addLiquidity, usar currentTokenA y currentTokenB.

addLiqBtn.onclick = async () => {
  if (!signer) {
    alert("Primero conecta tu wallet.");
    return;
  }

  liqStatus.innerText = "";

  try {
    const amountA = document.getElementById("liqAmountA").value;
    const amountB = document.getElementById("liqAmountB").value;

    if (!amountA || !amountB) {
      alert("Ingresa cantidades válidas para ambos tokens.");
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

    liqStatus.innerText = "Agregando liquidez...";
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

    liqStatus.innerText = "✅ Liquidez agregada correctamente.";
    updateUI();
  } catch (e) {
    console.error(e);
    liqStatus.innerText = "❌ Error: " + (e.reason || e.message);
  }

};

// Remover liquidez
remLiqBtn.onclick = async () => {
  if (!signer) {
    alert("Primero conecta tu wallet.");
    return;
  }
  remLiqStatus.innerText = "";
  try {
    const liquidityAmount = document.getElementById("liqAmountRemove").value;
    const contract = await getContract();
      
    const liquidity = ethers.parseUnits(liquidityAmount, 18);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Aprobar el contrato para gastar los tokens LP (que están en el contrato principal)
    const lpToken = await getTokenContract(CONTRACT_ADDRESS); // Asumiendo que los LP tokens son del mismo contrato
    remLiqStatus.innerText = "Aprobando token de Liquidez ..."
    let tx = await lpToken.approve(CONTRACT_ADDRESS, liquidity);
    await tx.wait();

    remLiqStatus.innerText = "Removiendo Liquidez ..."
    tx = await contract.removeLiquidity(
      currentTokenA,
      currentTokenB,
      liquidity,
      0, // amountAMin
      0, // amountBMin
      await signer.getAddress(),
      deadline
    );
    await tx.wait();
    remLiqStatus.innerText = "✅ Liquidez removida correctamente.";
    updateUI();
  } catch (e) {
    // console.error(e);
    remLiqStatus.innerText = "❌ Error: " + (e.reason || e.message);
  }
  
};