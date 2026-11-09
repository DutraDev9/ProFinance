import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import {
  Wallet,
  CreditCard,
  TrendingDown,
  Plus,
  Trash2,
  Sun,
  Moon,
  ShieldAlert,
  LogOut,
  Home,
  ShoppingBag,
  Layers,
  Users,
  Pencil,
  Check,
  X,
  Code,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  KeyRound,
  CheckCircle2,
  FileText,
  Upload,
  Loader2,
} from "lucide-react";

const firebaseConfig = {
  apiKey: "AIzaSyCsQJYqDTk3jwd3ZD3IDvfWjprk-IoFXR4",
  authDomain: "pro-finance-control.firebaseapp.com",
  projectId: "pro-finance-control",
  storageBucket: "pro-finance-control.firebasestorage.app",
  messagingSenderId: "1049329594472",
  appId: "1:1049329594472:web:8dad6bc3f5a343111e8bdd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

const SUPERADMIN_EMAILS = ["dumaster@teste.com", "admin@financas.com"];
const SESSION_DURATION_MS = 10 * 60 * 1000;
const SESSION_STORAGE_KEY = "pfc_login_timestamp";

const maskCurrencyInput = (value) => {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  const numberVal = Number(digits) / 100;
  return numberVal.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseMaskedCurrency = (value) => {
  if (!value) return 0;
  const clean = String(value).replace(/\./g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const formatBRL = (value) => {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const numberToMaskedCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toSafeInt = (val, fallback = 0) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toSafeNumber = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const clampDay = (val, fallback = 1) => {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(31, Math.max(1, n));
};

const isCardInvoiceClosedToday = (card) => {
  if (!card || !card.closingDay) return false;
  const todayDay = new Date().getDate();
  const closingDay = clampDay(card.closingDay, 1);
  return todayDay >= closingDay;
};

const loadPdfJsLibrary = async () => {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
};

const extractTextFromPdfFile = async (file) => {
  const pdfjsLib = await loadPdfJsLibrary();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    fullText += strings.join(" ") + "\n";
  }
  return fullText;
};

const guessCategoryFromText = (desc) => {
  const lower = String(desc || "").toLowerCase();
  if (/ifood|restaurante|lanch|burger|pizza|padaria|mercado|supermercado|atacad|carrefour|assai|acai|cafe|bar|doce/.test(lower)) {
    return "Alimentação";
  }
  if (/uber|99|posto|gasolina|combustivel|estacionamento|pedagio|onibus|metro|passagem|latam|gol|azul/.test(lower)) {
    return "Transporte";
  }
  if (/farmacia|droga|hospital|clinica|medico|exame|drogasil|pague menos|raia/.test(lower)) {
    return "Saúde";
  }
  if (/netflix|spotify|steam|cinema|ingresso|playstation|xbox|nintendo|jogo|prime|disney|hbo/.test(lower)) {
    return "Lazer";
  }
  if (/curso|faculdade|escola|livro|udemy|alura|educa/.test(lower)) {
    return "Educação";
  }
  return "Compras";
};

const parseInvoiceTextFallback = (rawText, fileName, userCards) => {
  const combinedSource = `${fileName || ""}\n${rawText || ""}`;
  let detectedCardName = "";

  for (const c of userCards || []) {
    if (c.name && new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(combinedSource)) {
      detectedCardName = c.name;
      break;
    }
  }

  if (!detectedCardName) {
    const knownBanks = [
      { regex: /nubank|nu pagamentos/i, name: "Nubank" },
      { regex: /mercado\s*pago/i, name: "Mercado Pago" },
      { regex: /inter|banco inter/i, name: "Inter" },
      { regex: /ita[uú]|itaucard/i, name: "Itaú" },
      { regex: /bradesco/i, name: "Bradesco" },
      { regex: /santander/i, name: "Santander" },
      { regex: /c6\s*bank|banco c6/i, name: "C6 Bank" },
      { regex: /picpay/i, name: "PicPay" },
      { regex: /caixa/i, name: "Caixa" },
      { regex: /banco do brasil|ourocard/i, name: "Banco do Brasil" },
      { regex: /xp\s*investimentos|cartao xp/i, name: "XP" },
    ];
    for (const bank of knownBanks) {
      if (bank.regex.test(combinedSource)) {
        detectedCardName = bank.name;
        break;
      }
    }
  }

  if (!detectedCardName) {
    detectedCardName = userCards?.[0]?.name || "Cartão de Crédito";
  }

  const ignoreRegex =
    /pagamento\s*(recebido|fatura|efetuado|minimo|total)|total\s*da\s*fatura|saldo\s*anterior|limite\s*(total|disponivel)|encargos|resumo\s*da\s*fatura|fatura\s*anterior|credito\s*em\s*confianca|estorno/i;

  const normalized = String(rawText || "")
    .replace(/\s+/g, " ")
    .replace(/(\d{2}\/\d{2}(?:\/\d{2,4})?|\d{1,2}\s+[A-ZÇÃÕÁÉÍÓÚ]{3})/gi, "\n$1");

  const lines = normalized.split("\n");
  const items = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || ignoreRegex.test(line)) continue;

    const match = line.match(
      /^(?:\d{2}\/\d{2}(?:\/\d{2,4})?|\d{1,2}\s+[A-ZÇÃÕÁÉÍÓÚ]{3})\s+(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})\b/i
    );
    if (!match) continue;

    let desc = match[1].trim();
    const amountStr = match[2];
    if (amountStr.startsWith("-") || ignoreRegex.test(desc)) continue;

    const installmentValue = parseMaskedCurrency(amountStr);
    if (installmentValue <= 0 || installmentValue > 200000) continue;

    let currentInstallment = 1;
    let totalInstallments = 1;

    const instMatch =
      desc.match(/(?:parcela\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i) ||
      line.match(/(?:parcela\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);

    if (instMatch) {
      const cur = parseInt(instMatch[1], 10);
      const tot = parseInt(instMatch[2], 10);
      if (cur >= 1 && tot >= cur && tot <= 48) {
        currentInstallment = cur;
        totalInstallments = tot;
        desc = desc.replace(instMatch[0], "").trim();
      }
    }

    desc = desc.replace(/[-–•*]+$/g, "").replace(/\s{2,}/g, " ").trim();
    if (!desc || desc.length < 2) continue;

    let what = desc;
    let where = desc;
    if (desc.includes("*")) {
      const parts = desc.split("*").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        where = parts[0];
        what = parts.slice(1).join(" - ");
      }
    } else if (desc.includes(" - ")) {
      const parts = desc.split(" - ").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        where = parts[0];
        what = parts.slice(1).join(" - ");
      }
    }

    items.push({
      id: `${Date.now()}-${ items.length}`,
      what: what.slice(0, 60),
      where: where.slice(0, 50),
      installmentValue,
      currentInstallment,
      totalInstallments,
      totalAmount: Number((installmentValue * totalInstallments).toFixed(2)),
      category: guessCategoryFromText(desc),
    });
  }

  return { detectedCardName, items };
};

const sanitizeCycle = (val) => {
  if (typeof val === "number" && Number.isFinite(val) && Math.abs(val) < 500) {
    return Math.trunc(val);
  }
  if (typeof val === "string" && /^-?\d+$/.test(val.trim())) {
    const n = parseInt(val.trim(), 10);
    if (Number.isFinite(n) && Math.abs(n) < 500) return n;
  }
  return 0;
};

// Agrupa compras no cartão de crédito feitas no mesmo lugar, mesmo cartão, mesmas parcelas e mesmo ciclo em uma única compra
const consolidateCardExpenses = (list) => {
  const chronological = [...(list || [])].reverse();
  const grouped = [];

  for (const exp of chronological) {
    const isCredit =
      exp.paymentMethod === "credito" ||
      String(exp.paymentLabel || "").startsWith("Cartão:");

    if (isCredit) {
      const normWhere = String(exp.where || "").trim().toLowerCase();
      const normSource = String(exp.paymentSource || "");
      const normInst = Math.max(1, toSafeInt(exp.installments, 1));
      const normCycle = sanitizeCycle(exp.startCycle);

      const existingIndex = grouped.findIndex((item) => {
        const itemIsCredit =
          item.paymentMethod === "credito" ||
          String(item.paymentLabel || "").startsWith("Cartão:");
        return (
          itemIsCredit &&
          String(item.where || "").trim().toLowerCase() === normWhere &&
          String(item.paymentSource || "") === normSource &&
          Math.max(1, toSafeInt(item.installments, 1)) === normInst &&
          sanitizeCycle(item.startCycle) === normCycle
        );
      });

      if (existingIndex !== -1) {
        const existing = grouped[existingIndex];
        const existingItems = String(existing.what || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const newItems = String(exp.what || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        for (const ni of newItems) {
          if (!existingItems.some((ei) => ei.toLowerCase() === ni.toLowerCase())) {
            existingItems.push(ni);
          }
        }

        grouped[existingIndex] = {
          ...existing,
          what: existingItems.join(", "),
        };
        continue;
      }
    }

    grouped.push(exp);
  }

  return grouped.reverse();
};

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [viewMode, setViewMode] = useState("preview");

  const [isRegistering, setIsRegistering] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const [activeView, setActiveView] = useState("dashboard");
  const [showOnlyActiveInCycle, setShowOnlyActiveInCycle] = useState(false);

  const [salary, setSalary] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currentCycle, setCurrentCycle] = useState(0);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState("");

  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState("");

  const [isEditingCards, setIsEditingCards] = useState(false);

  const [fixedName, setFixedName] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [editingFixedId, setEditingFixedId] = useState(null);
  const [editFixedName, setEditFixedName] = useState("");
  const [editFixedAmount, setEditFixedAmount] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardClosingDay, setCardClosingDay] = useState("1");
  const [cardDueDay, setCardDueDay] = useState("10");
  const [selectedCardIdForDetails, setSelectedCardIdForDetails] = useState("");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editCardName, setEditCardName] = useState("");
  const [editCardLimit, setEditCardLimit] = useState("");
  const [editCardClosingDay, setEditCardClosingDay] = useState("1");
  const [editCardDueDay, setEditCardDueDay] = useState("10");

  const [expWhat, setExpWhat] = useState("");
  const [expWhere, setExpWhere] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [isMultiplePurchase, setIsMultiplePurchase] = useState(false);
  const [extraPurchaseItems, setExtraPurchaseItems] = useState([]);
  const [extraItemInput, setExtraItemInput] = useState("");
  const [expCategory, setExpCategory] = useState("Alimentação");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [customCategories, setCustomCategories] = useState(["Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras"]);
  const [expPaymentMethod, setExpPaymentMethod] = useState("pix");
  const [expCreditCardId, setExpCreditCardId] = useState("");
  const [expInstallments, setExpInstallments] = useState(1);

  const [editingExpId, setEditingExpId] = useState(null);
  const [editExpWhat, setEditExpWhat] = useState("");
  const [editExpWhere, setEditExpWhere] = useState("");
  const [editExpAmount, setEditExpAmount] = useState("");
  const [editExpCategory, setEditExpCategory] = useState("Alimentação");
  const [editExpPaymentMethod, setEditExpPaymentMethod] = useState("pix");
  const [editExpCreditCardId, setEditExpCreditCardId] = useState("");
  const [editExpInstallments, setEditExpInstallments] = useState(1);

  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [pdfModalData, setPdfModalData] = useState(null);
  const [pdfFeedbackError, setPdfFeedbackError] = useState("");
  const pdfFileInputRef = React.useRef(null);

  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    document.title = "Controle Financeiro";
    const walletSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2310b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = `data:image/svg+xml,${walletSvg}`;
  }, []);

  useEffect(() => {
    let logoutTimer = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const loginTimestamp = localStorage.getItem(SESSION_STORAGE_KEY);
      const now = Date.now();

      if (currentUser && loginTimestamp) {
        const elapsed = now - Number(loginTimestamp);
        if (elapsed < SESSION_DURATION_MS) {
          await loadOrCreateUserData(currentUser);
          const remainingTime = SESSION_DURATION_MS - elapsed;
          if (logoutTimer) clearTimeout(logoutTimer);
          logoutTimer = setTimeout(async () => {
            localStorage.removeItem(SESSION_STORAGE_KEY);
            await signOut(auth);
            setUser(null);
          }, remainingTime);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          await signOut(auth);
          setUser(null);
        }
      } else {
        if (currentUser) await signOut(auth);
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setUser(null);
      }
      setLoadingAuth(false);
    });
    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      unsubscribe();
    };
  }, []);

  const loadOrCreateUserData = async (firebaseUser) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userRef);
    const isSuperAdmin = SUPERADMIN_EMAILS.includes(firebaseUser.email);

    if (snap.exists()) {
      const data = snap.data();
      const loadedSalary = Number(data.salary || 0);
      setUser({
        uid: firebaseUser.uid,
        name: data.name || firebaseUser.displayName || "Usuário",
        email: firebaseUser.email,
        role: isSuperAdmin ? "superadmin" : data.role || "user",
      });
      setSalary(loadedSalary);
      setSalaryInput(numberToMaskedCurrency(loadedSalary));
      setFixedExpenses(data.fixedExpenses || []);
      if (Array.isArray(data.customCategories) && data.customCategories.length > 0) {
        setCustomCategories(data.customCategories);
      }
      const loadedCards = data.cards || [];
      setCards(loadedCards);
      if (loadedCards.length > 0 && !selectedCardIdForDetails) {
        setSelectedCardIdForDetails(loadedCards[0].id);
      }
      const validCycle = sanitizeCycle(data.currentCycle);
      const cleanedExpenses = (data.expenses || []).map((exp) => {
        const inst = Math.max(1, toSafeInt(exp.installments, 1));
        const rawTotal = toSafeNumber(exp.totalAmount ?? exp.amount, 0);
        const rawInstVal = toSafeNumber(exp.installmentValue, 0);
        const totalAmount = rawTotal > 0 ? rawTotal : rawInstVal * inst;
        const installmentValue = rawInstVal > 0 ? rawInstVal : totalAmount / inst;
        return {
          ...exp,
          installments: inst,
          totalAmount,
          installmentValue,
          startCycle: sanitizeCycle(exp.startCycle),
        };
      });
      setExpenses(cleanedExpenses);
      setCurrentCycle(validCycle);
      if (data.currentCycle !== validCycle) {
        await setDoc(userRef, { currentCycle: validCycle }, { merge: true });
      }
    } else {
      const initialData = {
        name: firebaseUser.displayName || nameInput || "Usuário",
        email: firebaseUser.email,
        role: isSuperAdmin ? "superadmin" : "user",
        salary: 0,
        fixedExpenses: [],
        customCategories: ["Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras"],
        cards: [],
        expenses: [],
        currentCycle: 0,
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, initialData);
      setUser({ uid: firebaseUser.uid, ...initialData });
      setSalary(0);
      setSalaryInput("");
      setFixedExpenses([]);
      setCustomCategories(initialData.customCategories);
      setCards([]);
      setExpenses([]);
      setCurrentCycle(0);
    }
  };

  const saveUserData = async (updatedFields) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, updatedFields, { merge: true });
  };

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
      const cred = await signInWithPopup(auth, googleProvider);
      if (isRegistering && passwordInput && passwordInput.length >= 6) {
        try {
          await updatePassword(cred.user, passwordInput);
        } catch (pwdErr) {
          console.warn("Aviso ao vincular senha inicial:", pwdErr);
        }
      }
    } catch (err) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setAuthError("Erro ao autenticar com o Google: " + err.message);
    }
  };

  const handleLinkPassword = async (e) => {
    e.preventDefault();
    setPasswordFeedback("");
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setPasswordFeedback("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPasswordInput);
        setPasswordFeedback("Senha vinculada com sucesso! Agora você pode entrar com E-mail e Senha.");
        setNewPasswordInput("");
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordFeedback("");
        }, 2000);
      }
    } catch (err) {
      setPasswordFeedback("Para definir a senha, saia e entre novamente com o Google para renovar a sessão.");
    }
  };

  const handleChangeCycle = async (newCycle) => {
    const validCycle = sanitizeCycle(newCycle);
    setCurrentCycle(validCycle);
    await saveUserData({ currentCycle: validCycle });
  };

  const getCycleLabel = (offset) => {
    const validOffset = sanitizeCycle(offset);
    const d = new Date();
    d.setMonth(d.getMonth() + validOffset);
    const str = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const getExpenseCycleStatus = (exp, cycle) => {
    const totalInst = Math.max(1, toSafeInt(exp.installments, 1));
    const rawTotal = toSafeNumber(exp.totalAmount ?? exp.amount, 0);
    const rawInstVal = toSafeNumber(exp.installmentValue, 0);
    const totalVal = rawTotal > 0 ? rawTotal : rawInstVal * totalInst;
    const instVal = rawInstVal > 0 ? rawInstVal : totalVal / totalInst;
    const start = sanitizeCycle(exp.startCycle);
    const current = sanitizeCycle(cycle);
    const elapsed = current - start;

    if (elapsed < 0) {
      return {
        status: "future",
        currentInstallment: 0,
        totalInstallments: totalInst,
        remainingInstallments: totalInst,
        monthlyCharge: 0,
        remainingAmount: totalVal,
      };
    }

    if (elapsed >= totalInst) {
      return {
        status: elapsed === totalInst ? "paid" : "archived",
        currentInstallment: totalInst,
        totalInstallments: totalInst,
        remainingInstallments: 0,
        monthlyCharge: 0,
        remainingAmount: 0,
      };
    }

    const currentInst = elapsed + 1;
    const remainingInst = totalInst - elapsed;
    const remainingAmt = Math.max(0, totalVal - elapsed * instVal);

    return {
      status: "active",
      currentInstallment: currentInst,
      totalInstallments: totalInst,
      remainingInstallments: remainingInst,
      monthlyCharge: instVal,
      remainingAmount: remainingAmt,
    };
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, Date.now().toString());
      if (isRegistering) {
        const cred = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        if (nameInput) await updateProfile(cred.user, { displayName: nameInput });
        await loadOrCreateUserData(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      }
    } catch (err) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setAuthError("Falha na autenticação: " + err.message);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    await signOut(auth);
    setUser(null);
  };

  const handleSaveSalary = async (e) => {
    if (e) e.preventDefault();
    const num = parseMaskedCurrency(salaryInput);
    setSalary(num);
    setIsEditingSalary(false);
    await saveUserData({ salary: num });
  };

  const handleAddFixed = async (e) => {
    e.preventDefault();
    if (!fixedName.trim() || fixedAmount === "") return;
    const parsedAmount = parseMaskedCurrency(fixedAmount);
    const updated = [
      ...fixedExpenses,
      { id: Date.now().toString(), name: fixedName.trim(), amount: parsedAmount },
    ];
    setFixedExpenses(updated);
    setFixedName("");
    setFixedAmount("");
    await saveUserData({ fixedExpenses: updated });
  };

  const startEditFixed = (item) => {
    setEditingFixedId(item.id);
    setEditFixedName(item.name);
    setEditFixedAmount(numberToMaskedCurrency(item.amount));
  };

  const handleSaveFixedEdit = async (id) => {
    if (!editFixedName.trim()) return;
    const parsedAmount = parseMaskedCurrency(editFixedAmount);
    const updated = fixedExpenses.map((item) =>
      item.id === id ? { ...item, name: editFixedName.trim(), amount: parsedAmount } : item
    );
    setFixedExpenses(updated);
    setEditingFixedId(null);
    await saveUserData({ fixedExpenses: updated });
  };

  const handleRemoveFixed = async (id) => {
    const updated = fixedExpenses.filter((item) => item.id !== id);
    setFixedExpenses(updated);
    await saveUserData({ fixedExpenses: updated });
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!cardName.trim() || cardLimit === "") return;
    const parsedLimit = parseMaskedCurrency(cardLimit);
    const newCard = {
      id: Date.now().toString(),
      name: cardName.trim(),
      limit: parsedLimit,
      closingDay: clampDay(cardClosingDay, 1),
      dueDay: clampDay(cardDueDay, 10),
    };
    const updated = [...cards, newCard];
    setCards(updated);
    if (!selectedCardIdForDetails) {
      setSelectedCardIdForDetails(newCard.id);
    }
    setCardName("");
    setCardLimit("");
    setCardClosingDay("1");
    setCardDueDay("10");
    await saveUserData({ cards: updated });
  };

  const startEditCard = (card) => {
    setEditingCardId(card.id);
    setEditCardName(card.name);
    setEditCardLimit(numberToMaskedCurrency(card.limit));
    setEditCardClosingDay(String(card.closingDay || 1));
    setEditCardDueDay(String(card.dueDay || 10));
  };

  const handleSaveCardEdit = async (id) => {
    if (!editCardName.trim()) return;
    const newName = editCardName.trim();
    const parsedLimit = parseMaskedCurrency(editCardLimit);
    const closing = clampDay(editCardClosingDay, 1);
    const due = clampDay(editCardDueDay, 10);
    const updatedCards = cards.map((c) =>
      c.id === id
        ? { ...c, name: newName, limit: parsedLimit, closingDay: closing, dueDay: due }
        : c
    );
    const updatedExpenses = expenses.map((exp) => (exp.paymentSource === id ? { ...exp, paymentLabel: `Cartão: ${newName}` } : exp));
    setCards(updatedCards);
    setExpenses(updatedExpenses);
    setEditingCardId(null);
    await saveUserData({ cards: updatedCards, expenses: updatedExpenses });
  };

  const handleRemoveCard = async (id) => {
    const updated = cards.filter((c) => c.id !== id);
    setCards(updated);
    if (selectedCardIdForDetails === id) {
      setSelectedCardIdForDetails(updated.length > 0 ? updated[0].id : "");
    }
    await saveUserData({ cards: updated });
  };

  const handleCreateCategory = async (e) => {
    if (e) e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    const exists = customCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    const updatedCategories = exists ? customCategories : [...customCategories, trimmed];
    setCustomCategories(updatedCategories);
    setExpCategory(trimmed);
    setNewCategoryInput("");
    setIsAddingCategory(false);
    await saveUserData({ customCategories: updatedCategories });
  };

  const handleAddExtraItem = () => {
    const trimmed = extraItemInput.trim();
    if (!trimmed) return;
    if (!extraPurchaseItems.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      setExtraPurchaseItems([...extraPurchaseItems, trimmed]);
    }
    setExtraItemInput("");
  };

  const handleRemoveExtraItem = (idx) => {
    setExtraPurchaseItems(extraPurchaseItems.filter((_, i) => i !== idx));
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expWhat.trim() || !expWhere.trim()) return;

    const finalCategory = expCategory || "Alimentação";
    const cycleNow = sanitizeCycle(currentCycle);
    const chosenCard =
      expPaymentMethod === "credito"
        ? cards.find((c) => c.id === expCreditCardId)
        : null;
    const targetStartCycle =
      chosenCard && isCardInvoiceClosedToday(chosenCard)
        ? cycleNow + 1
        : cycleNow;

    const allItemsList = [
      expWhat.trim(),
      ...(isMultiplePurchase ? extraPurchaseItems : []),
      ...(isMultiplePurchase && extraItemInput.trim() ? [extraItemInput.trim()] : []),
    ].filter(Boolean);
    const combinedWhat = allItemsList.join(", ");

    if (isMultiplePurchase && expPaymentMethod === "credito") {
      const paymentSource = expCreditCardId || "credito";
      const installments = Math.max(1, Number(expInstallments) || 1);
      const normWhere = expWhere.trim().toLowerCase();

      const existingMatch = expenses.find((item) => {
        const itemIsCredit =
          item.paymentMethod === "credito" ||
          String(item.paymentLabel || "").startsWith("Cartão:");
        return (
          itemIsCredit &&
          String(item.where || "").trim().toLowerCase() === normWhere &&
          String(item.paymentSource || "") === String(paymentSource) &&
          Math.max(1, toSafeInt(item.installments, 1)) === installments &&
          sanitizeCycle(item.startCycle) === targetStartCycle
        );
      });

      if (existingMatch) {
        const existingItems = String(existingMatch.what || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const newItems = combinedWhat
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        for (const ni of newItems) {
          if (!existingItems.some((ei) => ei.toLowerCase() === ni.toLowerCase())) {
            existingItems.push(ni);
          }
        }

        const typedTotal = parseMaskedCurrency(expAmount);
        const finalTotal =
          existingMatch.totalAmount > 0 ? existingMatch.totalAmount : typedTotal;
        const finalInstValue =
          installments > 1 ? finalTotal / installments : finalTotal;

        const updated = expenses.map((item) =>
          item.id === existingMatch.id
            ? {
                ...item,
                what: existingItems.join(", "),
                totalAmount: finalTotal,
                installmentValue: finalInstValue,
              }
            : item
        );

        setExpenses(updated);
        setExpWhat("");
        setExpWhere("");
        setExpAmount("");
        setIsMultiplePurchase(false);
        setExtraPurchaseItems([]);
        setExtraItemInput("");
        setExpPaymentMethod("pix");
        setExpCreditCardId("");
        setExpInstallments(1);
        await saveUserData({ expenses: updated });
        return;
      }
    }

    if (expAmount === "") return;

    const total = parseMaskedCurrency(expAmount);
    let paymentLabel = "Pix / Débito";
    let paymentSource = expPaymentMethod;
    let installments = 1;

    if (expPaymentMethod === "pix") {
      paymentLabel = "Pix";
    } else if (expPaymentMethod === "debito") {
      paymentLabel = "Cartão de Débito";
    } else if (expPaymentMethod === "credito") {
      paymentLabel = chosenCard ? `Cartão: ${chosenCard.name}` : "Cartão de Crédito";
      paymentSource = expCreditCardId || "credito";
      installments = Math.max(1, Number(expInstallments) || 1);
    }

    const installmentValue = installments > 1 ? total / installments : total;

    const newExpense = {
      id: Date.now().toString(),
      what: combinedWhat,
      where: expWhere.trim(),
      totalAmount: total,
      category: finalCategory,
      paymentMethod: expPaymentMethod,
      paymentSource,
      paymentLabel,
      installments,
      installmentValue,
      isMultiple: isMultiplePurchase,
      startCycle: targetStartCycle,
      createdAt: new Date().toLocaleDateString("pt-BR"),
    };

    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    setExpWhat("");
    setExpWhere("");
    setExpAmount("");
    setIsMultiplePurchase(false);
    setExtraPurchaseItems([]);
    setExtraItemInput("");
    setExpPaymentMethod("pix");
    setExpCreditCardId("");
    setExpInstallments(1);
    await saveUserData({ expenses: updated });
  };

  const startEditExpense = (exp) => {
    setEditingExpId(exp.id);
    setEditExpWhat(exp.what);
    setEditExpWhere(exp.where);
    setEditExpAmount(numberToMaskedCurrency(exp.totalAmount));
    setEditExpCategory(exp.category || "Alimentação");
    setEditExpPaymentMethod(exp.paymentMethod || "pix");
    setEditExpCreditCardId(exp.paymentSource || "");
    setEditExpInstallments(exp.installments || 1);
  };

  const handleSaveExpenseEdit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editingExpId || !editExpWhat.trim() || !editExpWhere.trim()) return;
    const total = parseMaskedCurrency(editExpAmount);
    let paymentLabel = "Pix / Débito";
    let paymentSource = editExpPaymentMethod;
    let installments = 1;

    if (editExpPaymentMethod === "pix") {
      paymentLabel = "Pix";
    } else if (editExpPaymentMethod === "debito") {
      paymentLabel = "Cartão de Débito";
    } else if (editExpPaymentMethod === "credito") {
      const selectedCard = cards.find((c) => c.id === editExpCreditCardId);
      paymentLabel = selectedCard ? `Cartão: ${selectedCard.name}` : "Cartão de Crédito";
      paymentSource = editExpCreditCardId || "credito";
      installments = Math.max(1, Number(editExpInstallments) || 1);
    }

    const installmentValue = installments > 1 ? total / installments : total;

    const updated = expenses.map((exp) =>
      exp.id === editingExpId
        ? {
            ...exp,
            what: editExpWhat.trim(),
            where: editExpWhere.trim(),
            totalAmount: total,
            category: editExpCategory,
            paymentMethod: editExpPaymentMethod,
            paymentSource,
            paymentLabel,
            installments,
            installmentValue,
          }
        : exp
    );

    setExpenses(updated);
    setEditingExpId(null);
    await saveUserData({ expenses: updated });
  };

  const handlePdfFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsReadingPdf(true);
    setPdfFeedbackError("");

    try {
      let rawText = "";
      try {
        rawText = await extractTextFromPdfFile(file);
      } catch (err) {
        console.warn("Aviso ao extrair texto com PDF.js:", err);
      }

      let parsedResult = null;

      try {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = String(reader.result || "");
            resolve(res.split(",")[1] || "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const registeredCardNames = cards.map((c) => c.name).join(", ");
        const promptText = `Analise esta fatura de cartão de crédito em PDF (arquivo: "${file.name}").
Cartões cadastrados pelo usuário: [${registeredCardNames || "Nenhum"}].
1. Identifique a qual cartão ou banco esta fatura pertence (se corresponder a um dos cartões cadastrados, use exatamente o mesmo nome).
2. Extraia APENAS os lançamentos de consumo/compras da fatura (ignore pagamentos de fatura, saldo anterior, totais, limites, juros, IOF ou tarifas de resumo).
3. Para cada compra, identifique:
- "what": descrição do produto/compra ou estabelecimento
- "where": nome da loja/estabelecimento onde foi gasto
- "installmentValue": valor da parcela cobrada nesta fatura (número em reais, ex: 65.99)
- "currentInstallment": número da parcela atual (ex: se estiver 03/10, retorne 3; se for à vista, retorne 1)
- "totalInstallments": quantidade total de parcelas (ex: se estiver 03/10, retorne 10; se for à vista, retorne 1)
- "category": uma categoria entre ["Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras"]`;

        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

        const payload = {
          contents: [
            {
              role: "user",
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                cardName: { type: "STRING" },
                items: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      what: { type: "STRING" },
                      where: { type: "STRING" },
                      installmentValue: { type: "NUMBER" },
                      currentInstallment: { type: "INTEGER" },
                      totalInstallments: { type: "INTEGER" },
                      category: { type: "STRING" },
                    },
                    propertyOrdering: [
                      "what",
                      "where",
                      "installmentValue",
                      "currentInstallment",
                      "totalInstallments",
                      "category",
                    ],
                  },
                },
              },
              propertyOrdering: ["cardName", "items"],
            },
          },
        };

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            const parsedJson = JSON.parse(jsonText);
            if (Array.isArray(parsedJson.items) && parsedJson.items.length > 0) {
              parsedResult = {
                detectedCardName: parsedJson.cardName || "Cartão de Crédito",
                items: parsedJson.items.map((it, idx) => {
                  const instVal = Math.max(0, toSafeNumber(it.installmentValue, 0));
                  const totInst = Math.max(1, toSafeInt(it.totalInstallments, 1));
                  const curInst = Math.min(totInst, Math.max(1, toSafeInt(it.currentInstallment, 1)));
                  return {
                    id: `${Date.now()}-${idx}`,
                    what: String(it.what || it.where || "Compra na Fatura").trim(),
                    where: String(it.where || it.what || "Estabelecimento").trim(),
                    installmentValue: instVal,
                    currentInstallment: curInst,
                    totalInstallments: totInst,
                    totalAmount: Number((instVal * totInst).toFixed(2)),
                    category: it.category || guessCategoryFromText(it.what),
                  };
                }).filter((it) => it.installmentValue > 0),
              };
            }
          }
        }
      } catch (aiErr) {
        console.warn("Usando leitura local do PDF:", aiErr);
      }

      if (!parsedResult || parsedResult.items.length === 0) {
        parsedResult = parseInvoiceTextFallback(rawText, file.name, cards);
      }

      const matchedCard = cards.find(
        (c) =>
          c.name.toLowerCase() === String(parsedResult.detectedCardName || "").toLowerCase() ||
          String(parsedResult.detectedCardName || "").toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(String(parsedResult.detectedCardName || "").toLowerCase())
      );

      setPdfModalData({
        fileName: file.name,
        detectedCardName: matchedCard ? matchedCard.name : parsedResult.detectedCardName || "Cartão de Crédito",
        selectedCardId: matchedCard ? matchedCard.id : cards[0]?.id || "new",
        items: parsedResult.items || [],
      });
    } catch (err) {
      setPdfFeedbackError("Não foi possível ler o arquivo PDF selecionado.");
    } finally {
      setIsReadingPdf(false);
    }
  };

  const handleConfirmPdfImport = async () => {
    if (!pdfModalData) return;

    const cycleNow = sanitizeCycle(currentCycle);
    let targetCard = cards.find((c) => c.id === pdfModalData.selectedCardId);
    let updatedCards = [...cards];

    if (!targetCard) {
      const newCardName = (pdfModalData.detectedCardName || "Cartão Importado").trim();
      targetCard = {
        id: Date.now().toString(),
        name: newCardName,
        limit: 5000,
        closingDay: 1,
        dueDay: 10,
      };
      updatedCards = [...cards, targetCard];
      setCards(updatedCards);
      if (!selectedCardIdForDetails) {
        setSelectedCardIdForDetails(targetCard.id);
      }
    }

    const importedExpenses = (pdfModalData.items || []).map((item, idx) => {
      const totalInst = Math.max(1, toSafeInt(item.totalInstallments, 1));
      const currentInst = Math.min(totalInst, Math.max(1, toSafeInt(item.currentInstallment, 1)));
      const instValue = Math.max(0, toSafeNumber(item.installmentValue, 0));
      const totalAmt = Number((instValue * totalInst).toFixed(2));
      const calculatedStartCycle = cycleNow - (currentInst - 1);

      return {
        id: `${Date.now()}-${idx}`,
        what: String(item.what || "Consumo Fatura").trim(),
        where: String(item.where || "Fatura PDF").trim(),
        totalAmount: totalAmt,
        category: item.category || "Compras",
        paymentMethod: "credito",
        paymentSource: targetCard.id,
        paymentLabel: `Cartão: ${targetCard.name}`,
        installments: totalInst,
        installmentValue: instValue,
        isMultiple: false,
        startCycle: calculatedStartCycle,
        createdAt: new Date().toLocaleDateString("pt-BR"),
      };
    });

    const updatedExpenses = [...importedExpenses, ...expenses];
    setExpenses(updatedExpenses);
    setPdfModalData(null);
    await saveUserData({
      cards: updatedCards,
      expenses: updatedExpenses,
    });
  };

  const loadAllUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    setAllUsers(list);
  };

  const toggleUserRole = async (targetUser) => {
    const newRole = targetUser.role === "superadmin" ? "user" : "superadmin";
    await setDoc(doc(db, "users", targetUser.uid), { role: newRole }, { merge: true });
    await loadAllUsers();
  };

  const deleteUserAccountData = async (uid) => {
    await deleteDoc(doc(db, "users", uid));
    await loadAllUsers();
  };

  const totalFixed = fixedExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  // Cálculos dinâmicos baseados no ciclo atual (currentCycle)
  const totalExpenses = expenses.reduce((acc, item) => {
    const info = getExpenseCycleStatus(item, currentCycle);
    return acc + info.remainingAmount;
  }, 0);

  const totalMonthlyInstallments = expenses.reduce((acc, item) => {
    const info = getExpenseCycleStatus(item, currentCycle);
    return acc + info.monthlyCharge;
  }, 0);

  const totalSpentMonth = totalFixed + totalMonthlyInstallments;
  const remainingSalary = salary - totalSpentMonth;

  // Cálculos para o cartão selecionado considerando parcelas já abatidas nos ciclos
  const selectedCardObj = cards.find((c) => c.id === selectedCardIdForDetails) || cards[0];
  const selectedCardLimit = selectedCardObj ? Number(selectedCardObj.limit) || 0 : 0;
  const selectedCardUsed = selectedCardObj
    ? expenses
        .filter((e) => e.paymentSource === selectedCardObj.id)
        .reduce((acc, e) => {
          const info = getExpenseCycleStatus(e, currentCycle);
          return acc + info.remainingAmount;
        }, 0)
    : 0;
  const selectedCardAvailable = selectedCardLimit - selectedCardUsed;

  const displayedExpenses = expenses.filter((exp) => {
    const info = getExpenseCycleStatus(exp, currentCycle);
    if (info.status === "archived") return false;
    if (showOnlyActiveInCycle) return info.status === "active";
    return true;
  });

  const selectedExpenseCardObj =
    expPaymentMethod === "credito"
      ? cards.find((c) => c.id === expCreditCardId)
      : null;
  const isSelectedExpenseCardClosed = isCardInvoiceClosedToday(selectedExpenseCardObj);
  const expectedExpenseStartCycle = isSelectedExpenseCardClosed
    ? sanitizeCycle(currentCycle) + 1
    : sanitizeCycle(currentCycle);

  const matchedCardPurchase =
    isMultiplePurchase && expPaymentMethod === "credito" && expWhere.trim() && expCreditCardId
      ? expenses.find((item) => {
          const itemIsCredit =
            item.paymentMethod === "credito" ||
            String(item.paymentLabel || "").startsWith("Cartão:");
          return (
            itemIsCredit &&
            String(item.where || "").trim().toLowerCase() ===
              expWhere.trim().toLowerCase() &&
            String(item.paymentSource || "") === String(expCreditCardId) &&
            Math.max(1, toSafeInt(item.installments, 1)) ===
              Math.max(1, Number(expInstallments) || 1) &&
            sanitizeCycle(item.startCycle) === expectedExpenseStartCycle
          );
        })
      : null;

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 cursor-default select-none">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950 cursor-default">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 select-none">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white cursor-default">Controle Financeiro</h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm cursor-default">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm cursor-default">
              {authSuccess}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-sm mb-1 text-slate-600 dark:text-slate-400 cursor-default">Nome</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  placeholder="Seu nome"
                />
              </div>
            )}
            <div>
              <label className="block text-sm mb-1 text-slate-600 dark:text-slate-400 cursor-default">E-mail</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-600 dark:text-slate-400 cursor-default">
                {isRegistering ? "Senha (também usada se registrar com Google)" : "Senha"}
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition cursor-pointer"
            >
              {isRegistering ? "Criar Conta" : "Entrar"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400 cursor-default">OU ACESSO RÁPIDO</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-medium transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isRegistering ? "Cadastrar com Google (Vincular Senha)" : "Entrar com Google"}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500 cursor-default">
            {isRegistering ? "Já possui conta?" : "Ainda não tem conta?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
              }}
              className="text-emerald-500 font-medium hover:underline cursor-pointer"
            >
              {isRegistering ? "Fazer Login" : "Cadastre-se"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 cursor-default">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold cursor-default text-center sm:text-left">Controle Financeiro</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 cursor-default text-center sm:text-left">
              Olá, {user.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {user.role === "superadmin" && (
              <>
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition cursor-pointer ${viewMode === "preview" ? "bg-white dark:bg-slate-900 shadow text-emerald-500" : "text-slate-500"}`}
                  >
                    <Eye size={14} /> Prévia
                  </button>
                  <button
                    onClick={() => setViewMode("code")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition cursor-pointer ${viewMode === "code" ? "bg-white dark:bg-slate-900 shadow text-emerald-500" : "text-slate-500"}`}
                  >
                    <Code size={14} /> Código
                  </button>
                </div>

                <button
                  onClick={() => {
                    const next = activeView === "dashboard" ? "superadmin" : "dashboard";
                    setActiveView(next);
                    if (next === "superadmin") loadAllUsers();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30 cursor-pointer"
                >
                  <ShieldAlert size={16} />
                  {activeView === "superadmin" ? "Voltar ao Painel" : "SuperAdmin"}
                </button>
              </>
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer"
              title="Alternar tema"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <input
              ref={pdfFileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfFileSelect}
              className="hidden"
            />

            <button
              type="button"
              disabled={isReadingPdf}
              onClick={() => pdfFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 cursor-pointer transition disabled:opacity-60"
              title="Importar PDF da fatura do cartão de crédito"
            >
              {isReadingPdf ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Lendo PDF...
                </>
              ) : (
                <>
                  <FileText size={15} /> Ler Fatura PDF
                </>
              )}
            </button>

            <button
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordFeedback("");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              title="Definir senha para login direto por e-mail"
            >
              <KeyRound size={15} /> Senha
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 cursor-pointer"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 select-none">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-emerald-500">
                <KeyRound size={18} />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Definir Senha de Acesso</h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Defina uma senha para entrar diretamente com seu e-mail ({user.email}) sem precisar abrir a janela do Google.
            </p>
            {passwordFeedback && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                {passwordFeedback}
              </div>
            )}
            <form onSubmit={handleLinkPassword} className="space-y-3">
              <input
                type="password"
                required
                placeholder="Nova senha (mín. 6 caracteres)"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Senha
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE LEITURA DE FATURA PDF */}
      {pdfModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-purple-400">
                <FileText size={20} />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Confirmação de Leitura de Fatura
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPdfModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 mb-4">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                Você está informando a fatura do{" "}
                <strong className="text-purple-400 underline decoration-purple-500/50">
                  {cards.find((c) => c.id === pdfModalData.selectedCardId)?.name ||
                    pdfModalData.detectedCardName}
                </strong>{" "}
                adicionando apenas os detalhes do consumo.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Arquivo lido: {pdfModalData.fileName}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-1">
                Cartão identificado (você pode alterar se desejar):
              </label>
              <div className="relative group">
                <select
                  value={pdfModalData.selectedCardId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    const found = cards.find((c) => c.id === newId);
                    setPdfModalData({
                      ...pdfModalData,
                      selectedCardId: newId,
                      detectedCardName: found ? found.name : pdfModalData.detectedCardName,
                    });
                  }}
                  style={{ colorScheme: darkMode ? "dark" : "light" }}
                  className="w-full appearance-none pl-3 pr-9 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white text-xs font-semibold cursor-pointer transition hover:border-purple-500/60 focus:outline-none focus:border-purple-500"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {c.name} (Limite: {formatBRL(c.limit)})
                    </option>
                  ))}
                  <option value="new" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    + Criar / Usar cartão "{pdfModalData.detectedCardName}"
                  </option>
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-purple-400 transition"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>Detalhes do consumo identificados ({pdfModalData.items.length}):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Total na fatura:{" "}
                  {formatBRL(
                    pdfModalData.items.reduce((acc, it) => acc + (Number(it.installmentValue) || 0), 0)
                  )}
                </span>
              </div>

              {pdfModalData.items.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-center text-xs text-slate-500">
                  Nenhum detalhe de consumo pôde ser extraído automaticamente deste PDF.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-3">
                  {pdfModalData.items.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {item.what}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.where} • {item.category}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-amber-500 block">
                          {item.totalInstallments > 1
                            ? `Parcela ${item.currentInstallment}/${item.totalInstallments} de ${formatBRL(item.installmentValue)}`
                            : `À vista ${formatBRL(item.installmentValue)}`}
                        </span>
                        {item.totalInstallments > 1 && (
                          <span className="text-[10px] text-slate-400 block">
                            Total da compra: {formatBRL(item.totalAmount)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPdfModalData({
                            ...pdfModalData,
                            items: pdfModalData.items.filter((i) => i.id !== item.id),
                          })
                        }
                        className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                        title="Remover este item da importação"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPdfModalData(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pdfModalData.items.length === 0}
                onClick={handleConfirmPdfImport}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
              >
                <Check size={15} /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARD / MODAL PARA EDITAR GASTO DO HISTÓRICO */}
      {editingExpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-amber-500">
                <Pencil size={18} />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Editar Gasto</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-500 mb-1">O que foi gasto?</label>
                <input
                  type="text"
                  required
                  value={editExpWhat}
                  onChange={(e) => setEditExpWhat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Onde foi gasto?</label>
                  <input
                    type="text"
                    required
                    value={editExpWhere}
                    onChange={(e) => setEditExpWhere(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Valor Total (R$)</label>
                  <input
                    type="text"
                    required
                    value={editExpAmount}
                    onChange={(e) => setEditExpAmount(maskCurrencyInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Categoria</label>
                <div className="relative group">
                  <select
                    value={editExpCategory}
                    onChange={(e) => setEditExpCategory(e.target.value)}
                    style={{ colorScheme: darkMode ? "dark" : "light" }}
                    className="w-full appearance-none pl-3 pr-9 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white text-sm cursor-pointer transition hover:border-amber-500/60 focus:outline-none focus:border-amber-500"
                  >
                    {customCategories.map((cat) => (
                      <option key={cat} value={cat} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-amber-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Forma de Pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditExpPaymentMethod("pix");
                      setEditExpCreditCardId("");
                      setEditExpInstallments(1);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      editExpPaymentMethod === "pix"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Pix
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditExpPaymentMethod("debito");
                      setEditExpCreditCardId("");
                      setEditExpInstallments(1);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      editExpPaymentMethod === "debito"
                        ? "bg-blue-500 text-white border-blue-500"
                        : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Débito
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditExpPaymentMethod("credito")}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      editExpPaymentMethod === "credito"
                        ? "bg-purple-600 text-white border-purple-600"
                        : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    Crédito
                  </button>
                </div>
              </div>

              {editExpPaymentMethod === "credito" && (
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cartão</label>
                    <div className="relative group">
                      <select
                        value={editExpCreditCardId}
                        onChange={(e) => setEditExpCreditCardId(e.target.value)}
                        style={{ colorScheme: darkMode ? "dark" : "light" }}
                        className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white text-xs cursor-pointer"
                      >
                        <option value="">-- Escolha --</option>
                        {cards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Parcelas</label>
                    <div className="relative group">
                      <select
                        value={editExpInstallments}
                        onChange={(e) => setEditExpInstallments(Number(e.target.value))}
                        style={{ colorScheme: darkMode ? "dark" : "light" }}
                        className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white text-xs cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}x {n > 1 ? `(${formatBRL(parseMaskedCurrency(editExpAmount) / n)})` : "(À vista)"}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingExpId(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                >
                  <Check size={15} /> Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === "code" && user.role === "superadmin" ? (
        <main className="max-w-7xl mx-auto p-4 select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-bold mb-2 cursor-default">Código Atual (`src/App.jsx`)</h2>
            <p className="text-xs text-slate-500 mb-4 cursor-default">O código fonte está integrado em arquivo único.</p>
            <textarea
              readOnly
              value="// Aplicativo de controle financeiro configurado em React + Vite + Tailwind + Firebase (Single File)."
              className="w-full h-96 p-4 rounded-lg bg-slate-900 text-slate-200 font-mono text-xs cursor-text"
            />
          </div>
        </main>
      ) : activeView === "superadmin" && user.role === "superadmin" ? (
        <main className="max-w-7xl mx-auto p-4 space-y-6 select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={20} className="text-amber-500" />
              <h2 className="text-lg font-bold cursor-default">Administração de Contas de Usuários</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 cursor-default">Nome</th>
                    <th className="py-2 cursor-default">E-mail</th>
                    <th className="py-2 cursor-default">Salário</th>
                    <th className="py-2 cursor-default">Permissão</th>
                    <th className="py-2 text-right cursor-default">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {allUsers.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 font-medium cursor-default">{u.name}</td>
                      <td className="py-3 cursor-default">{u.email}</td>
                      <td className="py-3 cursor-default">{formatBRL(u.salary)}</td>
                      <td className="py-3 cursor-default">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-200 dark:bg-slate-800 cursor-default">{u.role || "user"}</span>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => toggleUserRole(u)}
                          className="px-2.5 py-1 rounded text-xs bg-blue-500/10 text-blue-500 cursor-pointer"
                        >
                          Alternar Admin
                        </button>
                        <button
                          onClick={() => deleteUserAccountData(u.uid)}
                          className="px-2.5 py-1 rounded text-xs bg-red-500/10 text-red-500 cursor-pointer"
                        >
                          Excluir Dados
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto p-4 space-y-6 select-none">
          {/* BARRA DE CONTROLE DE CICLO MENSAL */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Calendar size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Ciclo: {getCycleLabel(currentCycle)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {sanitizeCycle(currentCycle) === 0
                      ? "Mês Inicial"
                      : sanitizeCycle(currentCycle) > 0
                      ? `+${sanitizeCycle(currentCycle)} ${sanitizeCycle(currentCycle) === 1 ? "mês" : "meses"}`
                      : `${sanitizeCycle(currentCycle)} ${sanitizeCycle(currentCycle) === -1 ? "mês" : "meses"}`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Avance o ciclo para abater parcelas pagas, atualizar os números e liberar o limite dos cartões.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleChangeCycle(sanitizeCycle(currentCycle) - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer transition"
              >
                <ChevronLeft size={14} /> Mês Anterior
              </button>

              {sanitizeCycle(currentCycle) !== 0 && (
                <button
                  onClick={() => handleChangeCycle(0)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium cursor-pointer transition"
                  title="Voltar ao mês inicial"
                >
                  <RotateCcw size={13} /> Atual
                </button>
              )}

              <button
                onClick={() => handleChangeCycle(sanitizeCycle(currentCycle) + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition shadow-sm"
              >
                Virar Mês <ChevronRight size={14} />
              </button>
            </div>
          </section>

          {/* TOPO: 3 PAINÉIS LADO A LADO COM A MESMA ALTURA / TAMANHO (SALÁRIO, CARTÕES, TOTAL DE GASTOS) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. PAINEL DE SALÁRIO */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-emerald-500 cursor-default">
                    <Wallet size={18} />
                    <h2 className="font-bold text-slate-900 dark:text-white text-sm cursor-default">Painel de Salário</h2>
                  </div>
                  {!isEditingSalary && (
                    <button
                      onClick={() => {
                        setSalaryInput(numberToMaskedCurrency(salary));
                        setIsEditingSalary(true);
                      }}
                      className="flex items-center gap-1 text-xs text-emerald-500 hover:underline cursor-pointer"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-3 cursor-default">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5 cursor-default">
                    Saldo Livre Estimado
                  </span>
                  <span className={`text-2xl font-extrabold cursor-default ${remainingSalary >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {formatBRL(remainingSalary)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                {isEditingSalary ? (
                  <form onSubmit={handleSaveSalary} className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={salaryInput}
                        onChange={(e) => setSalaryInput(maskCurrencyInput(e.target.value))}
                        placeholder="0,00"
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm font-semibold"
                      />
                      <button type="submit" className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer" title="Salvar">
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingSalary(false)}
                        className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-pointer"
                        title="Cancelar"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    onClick={() => {
                      setSalaryInput(numberToMaskedCurrency(salary));
                      setIsEditingSalary(true);
                    }}
                    className="cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-500 cursor-pointer">Salário Informado:</span>
                    <span className="font-bold text-slate-900 dark:text-white cursor-pointer">{formatBRL(salary)}</span>
                  </div>
                )}
              </div>
            </section>

            {/* 2. PAINEL DE CARTÕES DE CRÉDITO COM SELECT INDIVIDUAL E HOVER */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-purple-500 cursor-default">
                    <CreditCard size={18} />
                    <h2 className="font-bold text-slate-900 dark:text-white text-sm cursor-default">Cartões de Crédito</h2>
                  </div>
                  <button
                    onClick={() => setIsEditingCards(!isEditingCards)}
                    className="flex items-center gap-1 text-xs text-purple-400 hover:underline cursor-pointer"
                  >
                    <Pencil size={12} /> {isEditingCards ? "Ver Cartão" : "Editar"}
                  </button>
                </div>

                {isEditingCards ? (
                  <div className="space-y-3 mb-2">
                    <form onSubmit={handleAddCard} className="space-y-2">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Nome (ex: Nubank)"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Limite R$"
                          value={cardLimit}
                          onChange={(e) => setCardLimit(maskCurrencyInput(e.target.value))}
                          className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 flex items-center gap-1 bg-slate-50 dark:bg-slate-800/70 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400">Fecha dia:</span>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={cardClosingDay}
                            onChange={(e) => setCardClosingDay(e.target.value)}
                            className="w-10 bg-transparent text-xs font-bold text-center focus:outline-none"
                          />
                        </div>
                        <div className="flex-1 flex items-center gap-1 bg-slate-50 dark:bg-slate-800/70 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400">Vence dia:</span>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={cardDueDay}
                            onChange={(e) => setCardDueDay(e.target.value)}
                            className="w-10 bg-transparent text-xs font-bold text-center focus:outline-none"
                          />
                        </div>
                        <button type="submit" className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white cursor-pointer" title="Adicionar Cartão">
                          <Plus size={16} />
                        </button>
                      </div>
                    </form>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {cards.map((c) => (
                        <div key={c.id} className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 text-xs">
                          {editingCardId === c.id ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 w-full">
                                <input
                                  type="text"
                                  value={editCardName}
                                  onChange={(e) => setEditCardName(e.target.value)}
                                  className="flex-1 min-w-0 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                                <input
                                  type="text"
                                  value={editCardLimit}
                                  onChange={(e) => setEditCardLimit(maskCurrencyInput(e.target.value))}
                                  className="w-20 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400">Fecha:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={editCardClosingDay}
                                    onChange={(e) => setEditCardClosingDay(e.target.value)}
                                    className="w-11 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center"
                                  />
                                  <span className="text-[10px] text-slate-400 ml-1">Vence:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={editCardDueDay}
                                    onChange={(e) => setEditCardDueDay(e.target.value)}
                                    className="w-11 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleSaveCardEdit(c.id)} className="p-1 text-emerald-500 cursor-pointer" title="Salvar">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => setEditingCardId(null)} className="p-1 text-slate-400 cursor-pointer" title="Cancelar">
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium block">{c.name} ({formatBRL(c.limit)})</span>
                                <span className="text-[10px] text-slate-400">
                                  Fecha dia {c.closingDay || 1} • Vence dia {c.dueDay || 10}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => startEditCard(c)} className="text-slate-400 hover:text-purple-500 cursor-pointer" title="Editar">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => handleRemoveCard(c.id)} className="text-slate-400 hover:text-red-500 cursor-pointer" title="Excluir">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : cards.length === 0 ? (
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-3 text-xs text-slate-400 cursor-default">
                    Nenhum cartão cadastrado. Clique em <strong>Editar</strong> acima para adicionar.
                  </div>
                ) : (
                  <div className="space-y-2 mb-3">
                    <div className="relative group">
                      <select
                        value={selectedCardIdForDetails}
                        onChange={(e) => setSelectedCardIdForDetails(e.target.value)}
                        style={{ colorScheme: darkMode ? "dark" : "light" }}
                        className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white text-xs font-semibold cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-purple-500/60 focus:outline-none focus:border-purple-500"
                      >
                        {cards.map((c) => (
                          <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={15}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-purple-400 transition"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 cursor-default">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 cursor-default">
                          Limite Disponível ({selectedCardObj?.name || "Cartão"})
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isCardInvoiceClosedToday(selectedCardObj)
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {isCardInvoiceClosedToday(selectedCardObj)
                            ? "Compras p/ próx. mês"
                            : "Fatura aberta"}
                        </span>
                      </div>
                      <span className="text-2xl font-extrabold text-purple-400 cursor-default block">
                        {formatBRL(selectedCardAvailable)}
                      </span>
                      <span className="block text-[11px] text-slate-400 mt-1 cursor-default">
                        Fecha dia <strong>{selectedCardObj?.closingDay || 1}</strong> • Vence dia <strong>{selectedCardObj?.dueDay || 10}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {!isEditingCards && selectedCardObj && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs flex justify-between text-slate-500">
                  <span>Limite Cartão: <strong className="text-slate-900 dark:text-white">{formatBRL(selectedCardLimit)}</strong></span>
                  <span>Em Uso: <strong className="text-rose-500">{formatBRL(selectedCardUsed)}</strong></span>
                </div>
              )}
            </section>

            {/* 3. PAINEL DE TOTAL DE GASTOS */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 text-rose-500 cursor-default">
                  <TrendingDown size={18} />
                  <h2 className="font-bold text-slate-900 dark:text-white text-sm cursor-default">Total de Gastos</h2>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Despesas Fixas:</span>
                    <span className="font-medium">{formatBRL(totalFixed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Parcelas do Mês:</span>
                    <span className="font-medium">{formatBRL(totalMonthlyInstallments)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Restante Acumulado:</span>
                    <span className="font-medium">{formatBRL(totalExpenses)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-sm font-bold">
                <span>Comprometido:</span>
                <span className="text-rose-500 text-base">{formatBRL(totalSpentMonth)}</span>
              </div>
            </section>

          </div>

          {/* SEGUNDA LINHA: REGISTRO DE GASTO (LATERAL ESQUERDA) + HISTÓRICO DE GASTOS (DIREITA) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* 1. REGISTRAR NOVO GASTO (LOGO ABAIXO DO SALÁRIO) */}
            <div className="lg:col-span-5 flex flex-col">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex-1 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-emerald-500 cursor-default">
                      <ShoppingBag size={20} />
                      <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Registrar Novo Gasto</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(!isAddingCategory)}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400 hover:underline cursor-pointer transition"
                    >
                      <Plus size={13} /> {isAddingCategory ? "Fechar" : "Nova Categoria"}
                    </button>
                  </div>

                  {isAddingCategory && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                      <span className="block text-[11px] font-semibold text-emerald-400 cursor-default">
                        Adicionar Nova Categoria
                      </span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Ex: Pets, Assinaturas, Viagem..."
                          value={newCategoryInput}
                          onChange={(e) => setNewCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateCategory();
                            }
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleCreateCategory}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition flex items-center gap-1"
                        >
                          <Check size={14} /> Salvar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddExpense} className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">O que foi gasto?</label>
                    <input
                      type="text"
                      placeholder="Ex: Teclado X98PRO, Supermercado..."
                      value={expWhat}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExpWhat(val);
                        if (!val.trim()) {
                          setIsMultiplePurchase(false);
                          setExtraPurchaseItems([]);
                          setExtraItemInput("");
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                    />

                    {expWhat.trim().length > 0 && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isMultiplePurchase}
                            onChange={(e) => setIsMultiplePurchase(e.target.checked)}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                          <span>Foi uma compra múltipla? (mesmo uso de cartão / pacote)</span>
                        </label>

                        {isMultiplePurchase && (
                          <div className="pt-1 space-y-2">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Adicione outros itens desta mesma compra ou agrupe com uma compra já lançada do mesmo local e parcelas sem descontar o limite duas vezes:
                            </p>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="Outro item na mesma compra..."
                                value={extraItemInput}
                                onChange={(e) => setExtraItemInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddExtraItem();
                                  }
                                }}
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              />
                              <button
                                type="button"
                                onClick={handleAddExtraItem}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer flex items-center gap-1"
                              >
                                <Plus size={13} /> Item
                              </button>
                            </div>
                            {extraPurchaseItems.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {extraPurchaseItems.map((it, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium"
                                  >
                                    {it}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExtraItem(idx)}
                                      className="hover:text-rose-400 cursor-pointer"
                                    >
                                      <X size={11} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Onde foi gasto?</label>
                    <input
                      type="text"
                      placeholder="Ex: Carrefour, Restaurante..."
                      value={expWhere}
                      onChange={(e) => setExpWhere(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Valor Total (R$)</label>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={expAmount}
                      onChange={(e) => setExpAmount(maskCurrencyInput(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1 cursor-default">Categoria</label>
                    <div className="relative group">
                      <select
                        value={expCategory}
                        onChange={(e) => setExpCategory(e.target.value)}
                        style={{ colorScheme: darkMode ? "dark" : "light" }}
                        className="w-full appearance-none pl-3 pr-9 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white text-sm cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-emerald-500/60 focus:outline-none focus:border-emerald-500"
                      >
                        {customCategories.map((cat) => (
                          <option key={cat} value={cat} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                            {cat}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-emerald-400 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1 cursor-default">Forma de Pagamento</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => { setExpPaymentMethod("pix"); setExpCreditCardId(""); setExpInstallments(1); }}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center justify-center ${expPaymentMethod === "pix" ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}
                      >
                        Pix
                      </button>
                      <button
                        type="button"
                        onClick={() => { setExpPaymentMethod("debito"); setExpCreditCardId(""); setExpInstallments(1); }}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center justify-center ${expPaymentMethod === "debito" ? "bg-blue-500 text-white border-blue-500 shadow-sm" : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}
                      >
                        Débito
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpPaymentMethod("credito")}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center justify-center ${expPaymentMethod === "credito" ? "bg-purple-600 text-white border-purple-600 shadow-sm" : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}
                      >
                        Crédito
                      </button>
                    </div>
                  </div>

                  {expPaymentMethod === "credito" && (
                    <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2.5">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1 cursor-default">Selecione o Cartão</label>
                        <div className="relative group">
                          <select
                            value={expCreditCardId}
                            onChange={(e) => setExpCreditCardId(e.target.value)}
                            required
                            style={{ colorScheme: darkMode ? "dark" : "light" }}
                            className="w-full appearance-none pl-3 pr-9 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white text-sm cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-purple-500/60 focus:outline-none focus:border-purple-500"
                          >
                            <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">-- Escolha o Cartão --</option>
                            {cards.map((c) => (
                              <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                {c.name} (Lim: {formatBRL(c.limit)})
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={16}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-purple-400 transition"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1 cursor-default">Parcelas</label>
                        <div className="relative group">
                          <select
                            value={expInstallments}
                            onChange={(e) => setExpInstallments(Number(e.target.value))}
                            style={{ colorScheme: darkMode ? "dark" : "light" }}
                            className="w-full appearance-none pl-3 pr-9 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white text-sm cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-purple-500/60 focus:outline-none focus:border-purple-500"
                          >
                            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                {n}x {n > 1 ? `de ${formatBRL(parseMaskedCurrency(expAmount) / n)}` : "(À vista)"}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={16}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-purple-400 transition"
                          />
                        </div>
                      </div>
                      {selectedExpenseCardObj && (
                        <div
                          className={`p-2.5 rounded-lg border text-[11px] cursor-default ${
                            isSelectedExpenseCardClosed
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          }`}
                        >
                          {isSelectedExpenseCardClosed ? (
                            <>
                              A fatura do <strong>{selectedExpenseCardObj.name}</strong> fechou dia{" "}
                              <strong>{selectedExpenseCardObj.closingDay || 1}</strong> (vence dia{" "}
                              <strong>{selectedExpenseCardObj.dueDay || 10}</strong>). Esta compra ocupará o limite agora, mas a{" "}
                              <strong>1ª parcela só virá no próximo mês ({getCycleLabel(expectedExpenseStartCycle)})</strong>.
                            </>
                          ) : (
                            <>
                              Fatura aberta (fecha dia <strong>{selectedExpenseCardObj.closingDay || 1}</strong> • vence dia{" "}
                              <strong>{selectedExpenseCardObj.dueDay || 10}</strong>). A 1ª parcela será cobrada na fatura deste mês.
                            </>
                          )}
                        </div>
                      )}
                      {matchedCardPurchase && (
                        <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-300 cursor-default">
                          Compra única detectada em <strong>{matchedCardPurchase.where}</strong> ({expInstallments}x): este item será agrupado junto com <strong>{matchedCardPurchase.what}</strong> no histórico sem descontar o limite novamente.
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 cursor-pointer transition mt-2"
                  >
                    <Plus size={16} /> Lançar Gasto
                  </button>
                </form>
              </section>
            </div>

            {/* 2. HISTÓRICO DE GASTOS, TOTAL E PARCELAS */}
            <div className="lg:col-span-7 flex flex-col">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex-1 flex flex-col h-full min-h-[420px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 text-amber-500 cursor-default">
                    <Layers size={20} />
                    <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Histórico de Gastos, Total e Parcelas</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOnlyActiveInCycle(!showOnlyActiveInCycle)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition ${
                      showOnlyActiveInCycle
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {showOnlyActiveInCycle ? "Mostrando: Ativos no Mês" : "Mostrar apenas ativos no mês"}
                  </button>
                </div>

                <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[380px]">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                        <th className="py-2 cursor-default">O que foi gasto</th>
                        <th className="py-2 cursor-default">Onde</th>
                        <th className="py-2 cursor-default">Categoria</th>
                        <th className="py-2 cursor-default">Pagamento</th>
                        <th className="py-2 cursor-default">Ciclo / Parcelas</th>
                        <th className="py-2 cursor-default">Total</th>
                        <th className="py-2 text-right cursor-default">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {displayedExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-xs text-slate-500 cursor-default">
                            Nenhum gasto registrado para este ciclo.
                          </td>
                        </tr>
                      ) : (
                        displayedExpenses.map((exp) => {
                          const cycleInfo = getExpenseCycleStatus(exp, currentCycle);
                          const isPaid = cycleInfo.status === "paid";
                          const isFuture = cycleInfo.status === "future";
                          return (
                            <tr key={exp.id} className={isPaid ? "opacity-50" : ""}>
                              <td className={`py-3 font-medium cursor-default ${isPaid ? "line-through text-slate-400" : ""}`}>
                                {exp.what}
                              </td>
                              <td className="py-3 text-slate-500 cursor-default">{exp.where}</td>
                              <td className="py-3 cursor-default">
                                <span className="px-2 py-0.5 rounded text-xs bg-slate-200 dark:bg-slate-800 cursor-default">
                                  {exp.category || "Geral"}
                                </span>
                              </td>
                              <td className="py-3 cursor-default">{exp.paymentLabel}</td>
                              <td className="py-3 cursor-default">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold text-[11px]">
                                    <CheckCircle2 size={12} /> Quitado ({cycleInfo.totalInstallments}/{cycleInfo.totalInstallments})
                                  </span>
                                ) : isFuture ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium text-[11px]">
                                    Próx. Fatura ({cycleInfo.totalInstallments}x de {formatBRL(exp.installmentValue)})
                                  </span>
                                ) : Number(exp.installments) > 1 ? (
                                  <div>
                                    <span className="font-bold text-amber-500">
                                      {cycleInfo.currentInstallment}/{cycleInfo.totalInstallments}
                                    </span>{" "}
                                    de{" "}
                                    <span className="font-medium cursor-default">
                                      {formatBRL(exp.installmentValue)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="cursor-default font-medium text-emerald-400">
                                    1/1 (À vista)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 font-bold cursor-default">
                                {isPaid ? (
                                  <span className="text-emerald-500 text-xs">R$ 0,00</span>
                                ) : (
                                  <div>
                                    <span>{formatBRL(cycleInfo.remainingAmount)}</span>
                                    {Number(exp.installments) > 1 && cycleInfo.currentInstallment > 1 && (
                                      <span className="block text-[10px] font-normal text-slate-400">
                                        de {formatBRL(exp.totalAmount)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 text-right space-x-2">
                                <button
                                  onClick={() => startEditExpense(exp)}
                                  className="text-slate-400 hover:text-amber-500 cursor-pointer"
                                  title="Editar gasto"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleRemoveExpense(exp.id)}
                                  className="text-slate-400 hover:text-red-500 cursor-pointer"
                                  title="Excluir gasto"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

          </div>

          {/* PARTE INFERIOR: DESPESAS FIXAS */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-blue-500 cursor-default">
                <Home size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Despesas Fixas</h2>
              </div>
              <span className="text-sm font-semibold text-slate-500 cursor-default">{formatBRL(totalFixed)}</span>
            </div>

            <form onSubmit={handleAddFixed} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                placeholder="Aluguel, Luz, Academia..."
                value={fixedName}
                onChange={(e) => setFixedName(e.target.value)}
                className="w-full sm:flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
              />
              <div className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Valor (R$)"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(maskCurrencyInput(e.target.value))}
                  className="flex-1 sm:w-32 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium cursor-pointer flex items-center justify-center gap-1 shrink-0"
                >
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fixedExpenses.length === 0 ? (
                <p className="text-xs text-slate-500 col-span-full py-2 cursor-default">Nenhuma despesa fixa cadastrada.</p>
              ) : (
                fixedExpenses.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm">
                    {editingFixedId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editFixedName}
                          onChange={(e) => setEditFixedName(e.target.value)}
                          className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                        <input
                          type="text"
                          value={editFixedAmount}
                          onChange={(e) => setEditFixedAmount(maskCurrencyInput(e.target.value))}
                          className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                        <button onClick={() => handleSaveFixedEdit(item.id)} className="text-emerald-500 cursor-pointer" title="Salvar">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingFixedId(null)} className="text-slate-400 cursor-pointer" title="Cancelar">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="cursor-default font-medium">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white cursor-default">
                            {formatBRL(item.amount)}
                          </span>
                          <button
                            onClick={() => startEditFixed(item)}
                            className="text-slate-400 hover:text-blue-500 cursor-pointer"
                            title="Editar despesa"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleRemoveFixed(item.id)}
                            className="text-slate-400 hover:text-red-500 cursor-pointer"
                            title="Excluir despesa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
