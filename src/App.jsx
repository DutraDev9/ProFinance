import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet,
  CreditCard,
  TrendingDown,
  Plus,
  Trash2,
  Edit2,
  LogOut,
  Shield,
  Eye,
  Code,
  Check,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  ShoppingBag,
  Calendar,
  FileText,
  Lock,
  CheckSquare,
  Square,
  AlertCircle,
  Upload,
  Users
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithPopup,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// ==========================================
// CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE
// ==========================================
const getFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return typeof __firebase_config === 'string'
        ? JSON.parse(__firebase_config)
        : __firebase_config;
    }
  } catch (_) {}

  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
    return window.__FIREBASE_CONFIG__;
  }

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) {
      return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
    }
  } catch (_) {}

  return {
    apiKey: 'AIzaSyDemoKey-ConfigureSuaChaveNoProjeto',
    authDomain: 'controle-financeiro.firebaseapp.com',
    projectId: 'controle-financeiro',
    storageBucket: 'controle-financeiro.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:000000000000'
  };
};

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let googleProvider = null;

try {
  const cfg = getFirebaseConfig();
  firebaseApp = !getApps().length ? initializeApp(cfg) : getApp();
  firebaseAuth = getAuth(firebaseApp);
  firestoreDb = getFirestore(firebaseApp);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (err) {
  console.warn('Modo local ativo (Firebase aguardando credenciais de produção):', err);
}

const isFirebaseConfigured = () => {
  const cfg = getFirebaseConfig();
  return Boolean(
    firebaseAuth &&
      firestoreDb &&
      cfg?.apiKey &&
      !String(cfg.apiKey).includes('AIzaSyDemoKey')
  );
};

if (!isFirebaseConfigured()) {
  console.warn(
    '[Firebase] Chave de API de demonstração em uso. Defina VITE_FIREBASE_* no .env e reinicie o servidor (npm run dev).'
  );
}

// Executa promessas do Firestore com timeout curto para nunca travar o login
const withTimeout = (promise, ms = 2000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);

// ==========================================
// UTILITÁRIOS DE MOEDA E CICLOS
// ==========================================

// Formata enquanto o usuário digita: "254462" -> "2.544,62"
const formatInputCurrency = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const numberValue = parseInt(digits, 10) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Converte um número real (ex: 752.22) para string mascarada ("752,22") sem multiplicar por 100
const numberToMaskedCurrency = (num) => {
  const n = Number(num);
  if (isNaN(n) || n <= 0) return '';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Converte string mascarada ("2.544,62") para float (2544.62)
const parseMaskedCurrency = (formattedValue) => {
  if (typeof formattedValue === 'number') return formattedValue;
  if (!formattedValue) return 0;
  const str = String(formattedValue).trim().replace(/[R$\s]/g, '');
  if (!str) return 0;
  if (str.includes(',')) {
    const clean = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  const digits = str.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

// Formata float para exibição "R$ 2.544,62"
const formatBRL = (value) => {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

// Garante que o índice de ciclo seja sempre um número inteiro válido (evita NaN)
const sanitizeCycle = (val) => {
  if (typeof val === 'number' && !isNaN(val)) return Math.trunc(val);
  return 0;
};

// Gera o nome do mês/ano conforme o deslocamento de ciclos a partir da data base
const getCycleLabel = (cycleOffset) => {
  const baseDate = new Date();
  const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + sanitizeCycle(cycleOffset), 1);
  const label = target.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const DEFAULT_CATEGORIES = [
  'Alimentação',
  'Compras',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Educação',
  'Assinaturas',
  'Outros'
];

export default function App() {
  // ==========================================
  // FAVICON, THEME-COLOR E FUNDO GLOBAL MOBILE
  // ==========================================
  useEffect(() => {
    const svgFavicon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" fill="#064e3b"/>
        <path d="M16 12h.01" stroke="#34d399" stroke-width="3"/>
        <path d="M2 10h20" stroke="#10b981"/>
      </svg>
    `.trim();
    const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svgFavicon)}`;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = encoded;
    document.title = 'Controle Financeiro';

    // Define a cor da barra de status e navegador no celular (iOS Safari / Chrome Android)
    let metaTheme = document.querySelector("meta[name='theme-color']");
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = '#070b14';

    let metaStatus = document.querySelector("meta[name='apple-mobile-web-app-status-bar-style']");
    if (!metaStatus) {
      metaStatus = document.createElement('meta');
      metaStatus.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(metaStatus);
    }
    metaStatus.content = 'black-translucent';

    let metaViewport = document.querySelector("meta[name='viewport']");
    if (!metaViewport) {
      metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      document.head.appendChild(metaViewport);
    }
    metaViewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';

    // Sobrescreve qualquer fundo branco padrão do navegador/Vite no modo claro do celular
    let globalStyle = document.getElementById('cf-mobile-fix-style');
    if (!globalStyle) {
      globalStyle = document.createElement('style');
      globalStyle.id = 'cf-mobile-fix-style';
      document.head.appendChild(globalStyle);
    }
    globalStyle.innerHTML = `
      :root, html, body, #root {
        background-color: #070b14 !important;
        color: #f1f5f9 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100vw !important;
        min-height: 100% !important;
        min-height: 100dvh !important;
        overflow-x: hidden !important;
        color-scheme: dark !important;
        display: block !important;
      }
      body {
        overscroll-behavior-y: none;
        -webkit-tap-highlight-color: transparent;
      }
    `;
  }, []);

  // ==========================================
  // ESTADOS DE AUTENTICAÇÃO E USUÁRIOS
  // ==========================================
  const DEFAULT_USERS_DB = {
    'dumaster@teste.com': {
      email: 'dumaster@teste.com',
      name: 'SuperAdmin',
      password: 'admin',
      role: 'superadmin'
    },
    'andreydutraa@gmail.com': {
      email: 'andreydutraa@gmail.com',
      name: 'Andrey Dutra',
      password: '123456',
      role: 'user'
    }
  };

  const getDeletedUsersList = () => {
    try {
      const raw = localStorage.getItem('cf_deleted_users_v5');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((e) => String(e).trim().toLowerCase());
      }
    } catch (_) {}
    return [];
  };

  const getLatestUsersDb = (fallbackState) => {
    const deletedList = getDeletedUsersList();
    try {
      const saved = localStorage.getItem('cf_users_db_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_USERS_DB, ...(fallbackState || {}) };
        Object.keys(parsed).forEach((k) => {
          const cleanKey = k.trim().toLowerCase();
          merged[cleanKey] = {
            ...(merged[cleanKey] || {}),
            ...parsed[k],
            email: cleanKey
          };
        });
        deletedList.forEach((delEmail) => {
          if (delEmail !== 'dumaster@teste.com') {
            delete merged[delEmail];
          }
        });
        return merged;
      }
    } catch (e) {
      console.error(e);
    }
    const initial = { ...DEFAULT_USERS_DB, ...(fallbackState || {}) };
    deletedList.forEach((delEmail) => {
      if (delEmail !== 'dumaster@teste.com') {
        delete initial[delEmail];
      }
    });
    return initial;
  };

  const [usersDb, setUsersDb] = useState(() => getLatestUsersDb());

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('cf_current_user_v5');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      return null;
    }
    return null;
  });

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Estados de Gerenciamento de Contas pelo SuperAdmin
  const [adminEditingEmail, setAdminEditingEmail] = useState(null);
  const [adminEditNameInput, setAdminEditNameInput] = useState('');
  const [adminDeletingEmail, setAdminDeletingEmail] = useState(null);
  const [adminFeedback, setAdminFeedback] = useState('');

  // Modal de configurar/alterar senha para entrar direto sem pop-up do Google
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newDirectPassword, setNewDirectPassword] = useState('');
  const [confirmDirectPassword, setConfirmDirectPassword] = useState('');
  const [passwordModalMessage, setPasswordModalMessage] = useState({ type: '', text: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Seletor Prévia / Código e Painel de Usuários (exclusivo para superadmin)
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'admin' | 'code'

  // Estados Financeiros Principais
  const [salary, setSalary] = useState(2544.62);
  const [salaryInput, setSalaryInput] = useState('2.544,62');
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(0);

  // Estados dos Cartões de Crédito
  const [cards, setCards] = useState([
    { id: 'card-1', name: 'Nubank', limit: 5200.0, closingDay: 1, dueDay: 10 },
    { id: 'card-2', name: 'Mercado Pago', limit: 11570.92, closingDay: 5, dueDay: 15 },
    { id: 'card-3', name: 'Itau', limit: 14870.99, closingDay: 10, dueDay: 20 }
  ]);
  const [selectedCardId, setSelectedCardId] = useState('card-1');
  const [isEditingCards, setIsEditingCards] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardClosingDay, setNewCardClosingDay] = useState('1');
  const [newCardDueDay, setNewCardDueDay] = useState('10');
  const [editingCardId, setEditingCardId] = useState(null);

  const [customCategories, setCustomCategories] = useState([]);
  const [showCategoryCreator, setShowCategoryCreator] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [fixedExpenses, setFixedExpenses] = useState([
    { id: 'fix-1', name: 'Aluguel', amount: 1200.0 },
    { id: 'fix-2', name: 'Academia', amount: 75.0 },
    { id: 'fix-3', name: 'Conta de Luz', amount: 160.0 }
  ]);
  const [fixedNameInput, setFixedNameInput] = useState('');
  const [fixedAmountInput, setFixedAmountInput] = useState('');
  const [editingFixedId, setEditingFixedId] = useState(null);

  const [expenses, setExpenses] = useState([
    {
      id: 'exp-1',
      what: 'Doce',
      where: 'Andrade',
      amount: 20.0,
      category: 'Alimentação',
      paymentMethod: 'credit',
      cardId: 'card-2',
      installments: 2,
      startCycle: 0
    },
    {
      id: 'exp-2',
      what: 'GTA 6',
      where: 'Steam',
      amount: 659.99,
      category: 'Compras',
      paymentMethod: 'credit',
      cardId: 'card-1',
      installments: 10,
      startCycle: 0
    }
  ]);

  // Estados do formulário "Registrar Novo Gasto"
  const [expWhat, setExpWhat] = useState('');
  const [isMultiPurchase, setIsMultiPurchase] = useState(false);
  const [multiItemsText, setMultiItemsText] = useState('');
  const [expWhere, setExpWhere] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Alimentação');
  const [expPaymentMethod, setExpPaymentMethod] = useState('pix'); // 'pix' | 'debit' | 'credit'
  const [expCardId, setExpCardId] = useState('card-1');
  const [expInstallments, setExpInstallments] = useState(1);

  // Modal de Edição de Gasto (Card bonito)
  const [editingExpense, setEditingExpense] = useState(null);
  const [editExpWhat, setEditExpWhat] = useState('');
  const [editExpWhere, setEditExpWhere] = useState('');
  const [editExpAmount, setEditExpAmount] = useState('');
  const [editExpCategory, setEditExpCategory] = useState('Alimentação');
  const [editExpPaymentMethod, setEditExpPaymentMethod] = useState('pix');
  const [editExpCardId, setEditExpCardId] = useState('');
  const [editExpInstallments, setEditExpInstallments] = useState(1);

  // Leitor de Fatura PDF
  const pdfInputRef = useRef(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [pdfConfirmModal, setPdfConfirmModal] = useState(null);

  // ==========================================
  // PERSISTÊNCIA POR USUÁRIO NO LOCALSTORAGE
  // ==========================================
  useEffect(() => {
    try {
      localStorage.setItem('cf_users_db_v5', JSON.stringify(usersDb));
    } catch (e) {
      console.error(e);
    }
  }, [usersDb]);

  // Sincroniza os dados do usuário e a senha atualizada diretamente do Firestore ao abrir o app
  useEffect(() => {
    if (!currentUser?.email || !isFirebaseConfigured()) return;
    const emailKey = currentUser.email.trim().toLowerCase();

    const syncFromFirestore = async () => {
      try {
        const userRef = doc(firestoreDb, 'users', emailKey);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const remoteUser = userSnap.data();
          setUsersDb((prev) => {
            const next = {
              ...prev,
              [emailKey]: {
                ...(prev[emailKey] || {}),
                ...remoteUser,
                email: emailKey
              }
            };
            try {
              localStorage.setItem('cf_users_db_v5', JSON.stringify(next));
            } catch (_) {}
            return next;
          });

          if (remoteUser.passwordUpdatedAt) {
            setCurrentUser((prev) =>
              prev ? { ...prev, passwordUpdatedAt: remoteUser.passwordUpdatedAt } : prev
            );
          }
        }
      } catch (err) {
        console.warn('Não foi possível sincronizar usuário do Firestore:', err);
      }
    };

    syncFromFirestore();
  }, [currentUser?.email]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('cf_current_user_v5', JSON.stringify(currentUser));
        const key = `cf_data_v5_${currentUser.email}`;
        let saved = localStorage.getItem(key);

        // Se ainda não houver na chave v5, procura dados anteriores salvos no navegador para não perder nada
        if (!saved) {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.includes(currentUser.email) && k !== key) {
              saved = localStorage.getItem(k);
              if (saved) break;
            }
          }
        }

        if (saved) {
          const parsed = JSON.parse(saved);
          const loadedSalary = Number(parsed.salary) || 0;
          setSalary(loadedSalary);
          setSalaryInput(numberToMaskedCurrency(loadedSalary));
          setCurrentCycle(sanitizeCycle(parsed.currentCycle));
          if (Array.isArray(parsed.cards) && parsed.cards.length > 0) {
            setCards(parsed.cards);
            setSelectedCardId(parsed.cards[0].id);
            setExpCardId(parsed.cards[0].id);
          }
          if (Array.isArray(parsed.customCategories)) {
            setCustomCategories(parsed.customCategories);
          }
          if (Array.isArray(parsed.fixedExpenses)) {
            setFixedExpenses(parsed.fixedExpenses);
          }
          if (Array.isArray(parsed.expenses)) {
            setExpenses(
              parsed.expenses.map((item) => ({
                ...item,
                amount: Number(item.amount) || 0,
                installments: Math.max(1, parseInt(item.installments, 10) || 1),
                startCycle: sanitizeCycle(item.startCycle)
              }))
            );
          }
        }
      } else {
        localStorage.removeItem('cf_current_user_v5');
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    try {
      const key = `cf_data_v5_${currentUser.email}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          salary,
          currentCycle: sanitizeCycle(currentCycle),
          cards,
          customCategories,
          fixedExpenses,
          expenses
        })
      );
    } catch (e) {
      console.error(e);
    }
  }, [currentUser, salary, currentCycle, cards, customCategories, fixedExpenses, expenses]);

  // Todas as categorias disponíveis (Padrão + Criadas pelo Usuário)
  const allCategories = useMemo(() => {
    const merged = [...DEFAULT_CATEGORIES];
    customCategories.forEach((cat) => {
      if (cat && !merged.includes(cat)) merged.push(cat);
    });
    return merged;
  }, [customCategories]);

  // Garante um cartão selecionado válido
  useEffect(() => {
    if (cards.length > 0 && !cards.some((c) => c.id === selectedCardId)) {
      setSelectedCardId(cards[0].id);
    }
    if (cards.length > 0 && !cards.some((c) => c.id === expCardId)) {
      setExpCardId(cards[0].id);
    }
  }, [cards, selectedCardId, expCardId]);

  // ==========================================
  // CÁLCULO DE CICLOS, PARCELAS E CARTÕES
  // ==========================================
  const processedExpenses = useMemo(() => {
    const activeCycle = sanitizeCycle(currentCycle);

    return expenses
      .map((exp) => {
        const totalAmount = Number(exp.amount) || 0;
        const installments = Math.max(1, parseInt(exp.installments, 10) || 1);
        const startCycle = sanitizeCycle(exp.startCycle);
        const installmentValue = totalAmount / installments;

        // Quantos meses se passaram desde o ciclo em que a compra iniciou
        const elapsed = activeCycle - startCycle;

        // Se estivermos visualizando um mês anterior ao início da fatura:
        if (elapsed < 0) {
          return {
            ...exp,
            installments,
            installmentValue,
            currentInstallmentNumber: 0,
            status: 'scheduled', // Agendado para próxima fatura
            monthlyCharge: 0,
            remainingAmount: totalAmount,
            visibleInHistory: true
          };
        }

        // Enquanto estiver pagando as parcelas (Ex: elapsed = 0 -> 1ª parcela; elapsed = 1 -> 2ª parcela)
        if (elapsed < installments) {
          const currentInstallmentNumber = elapsed + 1;
          const paidInstallmentsBeforeThisMonth = elapsed;
          const remainingAmount = Math.max(
            0,
            totalAmount - paidInstallmentsBeforeThisMonth * installmentValue
          );

          return {
            ...exp,
            installments,
            installmentValue,
            currentInstallmentNumber,
            status: 'active',
            monthlyCharge: installmentValue,
            remainingAmount,
            visibleInHistory: true
          };
        }

        // 1º mês imediatamente após quitar a última parcela: permanece visível como "Quitado"
        if (elapsed === installments) {
          return {
            ...exp,
            installments,
            installmentValue,
            currentInstallmentNumber: installments,
            status: 'paid',
            monthlyCharge: 0,
            remainingAmount: 0,
            visibleInHistory: true
          };
        }

        // A partir do 2º mês após quitado: sai automaticamente do histórico
        return {
          ...exp,
          installments,
          installmentValue,
          currentInstallmentNumber: installments,
          status: 'archived',
          monthlyCharge: 0,
          remainingAmount: 0,
          visibleInHistory: false
        };
      })
      .filter((item) => item.visibleInHistory);
  }, [expenses, currentCycle]);

  // Totais gerais e por cartão de crédito no ciclo atual
  const financialSummary = useMemo(() => {
    const totalFixed = fixedExpenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

    const monthlyInstallmentsTotal = processedExpenses.reduce(
      (acc, exp) => acc + (exp.status === 'active' ? exp.monthlyCharge : 0),
      0
    );

    const totalRemainingAccumulated = processedExpenses.reduce(
      (acc, exp) => acc + (exp.remainingAmount || 0),
      0
    );

    const totalCommittedMonth = totalFixed + monthlyInstallmentsTotal;
    const freeBalance = (Number(salary) || 0) - totalCommittedMonth;

    // Uso de limite por cartão de crédito (soma o valor restante das compras no cartão)
    const cardUsageMap = {};
    cards.forEach((c) => {
      cardUsageMap[c.id] = 0;
    });

    processedExpenses.forEach((exp) => {
      if (exp.paymentMethod === 'credit' && exp.cardId && cardUsageMap[exp.cardId] !== undefined) {
        cardUsageMap[exp.cardId] += exp.remainingAmount || 0;
      }
    });

    return {
      totalFixed,
      monthlyInstallmentsTotal,
      totalRemainingAccumulated,
      totalCommittedMonth,
      freeBalance,
      cardUsageMap
    };
  }, [fixedExpenses, processedExpenses, salary, cards]);

  const selectedCard = useMemo(() => {
    return cards.find((c) => c.id === selectedCardId) || cards[0] || null;
  }, [cards, selectedCardId]);

  // Verifica se hoje o cartão selecionado já fechou a fatura do mês
  const isCardClosedToday = (card) => {
    if (!card) return false;
    const todayDay = new Date().getDate();
    const closingDay = parseInt(card.closingDay, 10) || 1;
    const dueDay = parseInt(card.dueDay, 10) || 10;
    if (closingDay <= dueDay) {
      return todayDay >= closingDay;
    }
    return todayDay >= closingDay;
  };

  // ==========================================
  // HANDLERS DE AUTENTICAÇÃO
  // ==========================================
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias em milissegundos
  const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutos de inatividade para logout automático

  const handleLogout = async (customMessage = '') => {
    if (isFirebaseConfigured() && firebaseAuth) {
      try {
        await signOut(firebaseAuth);
      } catch (_) {}
    }
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.disableAutoSelect();
      } catch (_) {}
    }
    setCurrentUser(null);
    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthError(customMessage || '');
    setAuthSuccess('');
    setShowPasswordModal(false);
    try {
      localStorage.removeItem('cf_current_user_v5');
      localStorage.removeItem('cf_last_activity_v5');
      sessionStorage.clear();
    } catch (_) {}
  };

  // Monitora atividade do usuário e faz logout automático após 10 minutos sem uso
  useEffect(() => {
    if (!currentUser) return;

    let inactivityTimer;

    const handleInactivityLogout = () => {
      handleLogout('Sessão encerrada automaticamente após 10 minutos de inatividade.');
    };

    const resetInactivityTimer = () => {
      try {
        localStorage.setItem('cf_last_activity_v5', String(Date.now()));
      } catch (_) {}
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
    };

    try {
      const lastAct = Number(localStorage.getItem('cf_last_activity_v5') || 0);
      if (lastAct > 0 && Date.now() - lastAct >= INACTIVITY_LIMIT_MS) {
        handleInactivityLogout();
        return;
      }
    } catch (_) {}

    resetInactivityTimer();

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetInactivityTimer, { passive: true }));

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [currentUser]);

  const getPasswordCooldownInfo = (userEmail) => {
    if (!userEmail) return { isLocked: false, remainingDays: 0, unlockDateStr: '' };
    const emailKey = userEmail.trim().toLowerCase();
    const latestDb = getLatestUsersDb(usersDb);
    const userRecord = latestDb[emailKey];
    const lastChange = userRecord?.passwordUpdatedAt || currentUser?.passwordUpdatedAt || 0;
    if (!lastChange) return { isLocked: false, remainingDays: 0, unlockDateStr: '' };

    const elapsed = Date.now() - Number(lastChange);
    if (elapsed >= ONE_MONTH_MS) {
      return { isLocked: false, remainingDays: 0, unlockDateStr: '' };
    }

    const remainingMs = ONE_MONTH_MS - elapsed;
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    const unlockDate = new Date(Number(lastChange) + ONE_MONTH_MS);
    const unlockDateStr = unlockDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return { isLocked: true, remainingDays, unlockDateStr };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const emailClean = authEmail.trim().toLowerCase();
    const typedPassword = authPassword.trim();

    if (!emailClean || !typedPassword) {
      setAuthError('Preencha seu e-mail e senha.');
      return;
    }

    let latestDb = getLatestUsersDb(usersDb);

    // Se o Firebase estiver ativo, busca primeiro os dados mais recentes da conta no Firestore
    if (isFirebaseConfigured()) {
      try {
        const targetKey =
          emailClean === 'dumaster' ? 'dumaster@teste.com' : emailClean;
        const snap = await withTimeout(getDoc(doc(firestoreDb, 'users', targetKey)), 2000);
        if (snap && snap.exists()) {
          const remoteData = snap.data();
          latestDb = {
            ...latestDb,
            [targetKey]: {
              ...(latestDb[targetKey] || {}),
              ...remoteData,
              email: targetKey
            }
          };
        }
      } catch (_) {}
    }

    // Conta SuperAdmin (dumaster@teste.com) sempre garantida no sistema
    if (emailClean === 'dumaster@teste.com' || emailClean === 'dumaster') {
      const adminEmail = 'dumaster@teste.com';
      const existingAdmin = latestDb[adminEmail];

      if (
        (existingAdmin?.passwordUpdatedAt || existingAdmin?.customAdminPasswordSet) &&
        existingAdmin?.password &&
        typedPassword !== existingAdmin.password
      ) {
        setAuthError('Senha incorreta para o SuperAdmin.');
        return;
      }

      const updatedAdminRecord = {
        ...(existingAdmin || {}),
        email: adminEmail,
        name: existingAdmin?.name || 'SuperAdmin',
        role: 'superadmin',
        password: existingAdmin?.passwordUpdatedAt ? existingAdmin.password : typedPassword,
        customAdminPasswordSet: true,
        passwordUpdatedAt: existingAdmin?.passwordUpdatedAt || null
      };

      const nextDb = {
        ...latestDb,
        [adminEmail]: updatedAdminRecord
      };

      try {
        localStorage.setItem('cf_users_db_v5', JSON.stringify(nextDb));
      } catch (_) {}

      if (isFirebaseConfigured()) {
        withTimeout(setDoc(doc(firestoreDb, 'users', adminEmail), updatedAdminRecord, { merge: true }), 2000).catch(() => {});
      }

      setUsersDb(nextDb);
      setAuthPassword('');
      setCurrentUser({
        email: adminEmail,
        name: updatedAdminRecord.name,
        role: 'superadmin',
        passwordUpdatedAt: updatedAdminRecord.passwordUpdatedAt
      });
      return;
    }

    // Tenta autenticar no Firebase Auth caso esteja configurado
    if (isFirebaseConfigured()) {
      try {
        await signInWithEmailAndPassword(firebaseAuth, emailClean, typedPassword);
      } catch (fbErr) {
        const existingInFirestore = latestDb[emailClean];
        if (
          !existingInFirestore ||
          String(existingInFirestore.password || '').trim() !== typedPassword
        ) {
          setAuthError('E-mail ou senha incorretos.');
          return;
        }
      }
    }

    const existing = latestDb[emailClean];

    if (!existing) {
      setAuthError('Conta não encontrada. Cadastre-se ou entre com o Google.');
      return;
    }

    if (String(existing.password || '').trim() !== typedPassword) {
      setAuthError('E-mail ou senha incorretos.');
      return;
    }

    setUsersDb(latestDb);
    setAuthPassword('');
    setCurrentUser({
      email: existing.email,
      name: existing.name,
      role: existing.role || 'user',
      passwordUpdatedAt: existing.passwordUpdatedAt || null
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const emailClean = authEmail.trim().toLowerCase();
    const typedPassword = authPassword.trim();

    if (!authName.trim() || !emailClean || !typedPassword) {
      setAuthError('Preencha nome, e-mail e senha para criar sua conta.');
      return;
    }

    if (typedPassword.length < 6) {
      setAuthError('A senha deve ter pelo menos 6 caracteres (padrão Firebase).');
      return;
    }

    const latestDb = getLatestUsersDb(usersDb);
    const existing = latestDb[emailClean];

    if (existing) {
      setAuthError('Este e-mail já possui cadastro. Use a aba "Entrar com Senha" ou "Entrar com Google".');
      return;
    }

    if (isFirebaseConfigured()) {
      try {
        await createUserWithEmailAndPassword(firebaseAuth, emailClean, typedPassword);
      } catch (fbErr) {
        if (fbErr?.code === 'auth/email-already-in-use') {
          setAuthError('Este e-mail já está cadastrado no Firebase. Faça login.');
          return;
        }
      }
    }

    const role = emailClean === 'dumaster@teste.com' ? 'superadmin' : 'user';
    const newUser = {
      email: emailClean,
      name: authName.trim(),
      password: typedPassword,
      role,
      passwordUpdatedAt: null
    };

    // Caso o e-mail tenha sido excluído anteriormente pelo admin, remove da lista de excluídos
    try {
      const deletedList = getDeletedUsersList().filter((e) => e !== emailClean);
      localStorage.setItem('cf_deleted_users_v5', JSON.stringify(deletedList));
    } catch (_) {}

    if (isFirebaseConfigured()) {
      withTimeout(setDoc(doc(firestoreDb, 'users', emailClean), newUser, { merge: true }), 2000).catch(() => {});
    }

    const nextDb = { ...latestDb, [emailClean]: newUser };
    try {
      localStorage.setItem('cf_users_db_v5', JSON.stringify(nextDb));
    } catch (_) {}

    setUsersDb(nextDb);
    setAuthPassword('');
    setCurrentUser({
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      passwordUpdatedAt: null
    });
  };

  const handleSelectGoogleAccount = async (account) => {
    if (!account || !account.email) return;
    const emailClean = account.email.trim().toLowerCase();
    const role = emailClean === 'dumaster@teste.com' ? 'superadmin' : 'user';

    try {
      const deletedList = getDeletedUsersList().filter((e) => e !== emailClean);
      localStorage.setItem('cf_deleted_users_v5', JSON.stringify(deletedList));
    } catch (_) {}

    let latestDb = getLatestUsersDb(usersDb);

    if (isFirebaseConfigured()) {
      try {
        const snap = await withTimeout(getDoc(doc(firestoreDb, 'users', emailClean)), 2000);
        if (snap && snap.exists()) {
          latestDb = {
            ...latestDb,
            [emailClean]: { ...(latestDb[emailClean] || {}), ...snap.data(), email: emailClean }
          };
        }
      } catch (_) {}
    }

    const existing = latestDb[emailClean];

    // Mantém a senha já existente; só define uma nova se veio do cadastro e não está em cooldown
    let finalPassword = existing?.password || '';
    let finalPasswordUpdatedAt = existing?.passwordUpdatedAt || null;

    const cooldown = getPasswordCooldownInfo(emailClean);
    if (account.password && String(account.password).length >= 6 && !cooldown.isLocked) {
      finalPassword = String(account.password);
      finalPasswordUpdatedAt = Date.now();
    }

    const resolvedName =
      account.name?.trim() ||
      existing?.name ||
      emailClean.split('@')[0].replace(/[._-]/g, ' ');

    const updatedUser = {
      ...(existing || {}),
      email: emailClean,
      name: resolvedName,
      role,
      passwordUpdatedAt: finalPasswordUpdatedAt,
      ...(finalPassword ? { password: finalPassword } : {})
    };

    const nextDb = { ...latestDb, [emailClean]: updatedUser };
    try {
      localStorage.setItem('cf_users_db_v5', JSON.stringify(nextDb));
    } catch (_) {}

    setUsersDb(nextDb);
    setAuthPassword('');
    setCurrentUser({
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      passwordUpdatedAt: updatedUser.passwordUpdatedAt
    });

    if (isFirebaseConfigured()) {
      withTimeout(setDoc(doc(firestoreDb, 'users', emailClean), updatedUser, { merge: true }), 2500).catch(() => {});
    }
  };

  const GOOGLE_ERROR_MESSAGES = {
    'auth/unauthorized-domain':
      'Domínio não autorizado. Adicione este domínio em Firebase → Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed':
      'O provedor Google não está ativado. Ative em Firebase → Authentication → Sign-in method.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      'Chave de API do Firebase inválida. Confira o .env.',
    'auth/invalid-api-key': 'Chave de API do Firebase inválida. Confira o .env.',
    'auth/configuration-not-found':
      'Authentication ainda não foi iniciado no projeto Firebase (clique em "Começar" no console).',
    'auth/network-request-failed': 'Falha de rede. Verifique sua conexão.'
  };

  const handleGoogleButtonClick = async () => {
    setAuthError('');
    setAuthSuccess('');

    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isSandboxPreview =
      host.includes('usercontent.goog') ||
      host.includes('webcontainer') ||
      host.includes('stackblitz');

    if (isSandboxPreview) {
      setAuthError(
        'O login com Google não funciona neste ambiente de preview. Rode em localhost ou no domínio publicado.'
      );
      return;
    }

    if (!isFirebaseConfigured()) {
      console.error('[Google Login] Firebase não configurado. Host:', host);
      setAuthError(
        'Firebase não configurado: defina as variáveis VITE_FIREBASE_* no .env e reinicie o servidor.'
      );
      return;
    }

    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const user = result?.user;
      if (!user?.email) {
        setAuthError('O Google não retornou um e-mail para esta conta.');
        return;
      }

      let newPassword = null;
      if (authMode === 'register' && authPassword.trim().length >= 6) {
        try {
          await updatePassword(user, authPassword.trim());
          newPassword = authPassword.trim();
        } catch (e) {
          console.warn('Não foi possível vincular a senha:', e?.code);
        }
      }

      await handleSelectGoogleAccount({
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        password: newPassword
      });
    } catch (err) {
      console.error('[Google Login] Erro:', err?.code, err?.message);

      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }

      // Popup bloqueado (comum no celular): tenta o fluxo por redirecionamento
      if (err?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(firebaseAuth, googleProvider);
          return;
        } catch (redirectErr) {
          console.error('[Google Login] Redirect falhou:', redirectErr?.code);
        }
      }

      setAuthError(
        GOOGLE_ERROR_MESSAGES[err?.code] ||
          `Falha no login com Google (${err?.code || 'erro desconhecido'}).`
      );
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured() || !firebaseAuth) return;
    getRedirectResult(firebaseAuth)
      .then((result) => {
        if (result?.user?.email) {
          handleSelectGoogleAccount({
            email: result.user.email,
            name: result.user.displayName || result.user.email.split('@')[0]
          });
        }
      })
      .catch((err) => {
        console.error('[Google Redirect] Erro:', err?.code, err?.message);
        setAuthError(
          GOOGLE_ERROR_MESSAGES[err?.code] || `Falha no login com Google (${err?.code}).`
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================
  // HANDLERS DO PAINEL SUPERADMIN (EDITAR NOME E EXCLUIR CONTA)
  // ==========================================
  const handleAdminUpdateUserName = async (targetEmail) => {
    const cleanEmail = String(targetEmail || '').trim().toLowerCase();
    const cleanName = adminEditNameInput.trim();
    if (!cleanEmail || !cleanName) return;

    const latestDb = getLatestUsersDb(usersDb);
    const existingUser = latestDb[cleanEmail];
    if (!existingUser) return;

    const updatedUser = {
      ...existingUser,
      name: cleanName
    };

    const nextDb = {
      ...latestDb,
      [cleanEmail]: updatedUser
    };

    try {
      localStorage.setItem('cf_users_db_v5', JSON.stringify(nextDb));
    } catch (_) {}

    setUsersDb(nextDb);

    if (currentUser?.email?.toLowerCase() === cleanEmail) {
      const updatedCurrent = { ...currentUser, name: cleanName };
      setCurrentUser(updatedCurrent);
      try {
        localStorage.setItem('cf_current_user_v5', JSON.stringify(updatedCurrent));
      } catch (_) {}
    }

    if (isFirebaseConfigured()) {
      withTimeout(setDoc(doc(firestoreDb, 'users', cleanEmail), updatedUser, { merge: true }), 2500).catch(
        () => {}
      );
    }

    setAdminEditingEmail(null);
    setAdminEditNameInput('');
    setAdminFeedback(`Nome do usuário ${cleanEmail} atualizado para "${cleanName}".`);
    setTimeout(() => setAdminFeedback(''), 4000);
  };

  const handleAdminDeleteUser = async (targetEmail) => {
    const cleanEmail = String(targetEmail || '').trim().toLowerCase();
    if (!cleanEmail || cleanEmail === 'dumaster@teste.com') return;

    const latestDb = getLatestUsersDb(usersDb);
    const nextDb = { ...latestDb };
    delete nextDb[cleanEmail];

    try {
      const deletedList = getDeletedUsersList();
      if (!deletedList.includes(cleanEmail)) {
        deletedList.push(cleanEmail);
      }
      localStorage.setItem('cf_deleted_users_v5', JSON.stringify(deletedList));
      localStorage.setItem('cf_users_db_v5', JSON.stringify(nextDb));
      localStorage.removeItem(`cf_data_v5_${cleanEmail}`);
    } catch (_) {}

    setUsersDb(nextDb);
    setAdminDeletingEmail(null);

    if (isFirebaseConfigured()) {
      withTimeout(deleteDoc(doc(firestoreDb, 'users', cleanEmail)), 2500).catch(() => {});
    }

    setAdminFeedback(`Conta ${cleanEmail} excluída com sucesso.`);
    setTimeout(() => setAdminFeedback(''), 4000);
  };

  const handleSaveDirectPassword = async (e) => {
    e.preventDefault();
    setPasswordModalMessage({ type: '', text: '' });
    if (!currentUser || isSavingPassword) return;

    const emailKey = currentUser.email.trim().toLowerCase();
    const cooldown = getPasswordCooldownInfo(emailKey);

    if (cooldown.isLocked) {
      setPasswordModalMessage({
        type: 'error',
        text: `Você já alterou sua senha recentemente. Nova alteração liberada em ${cooldown.remainingDays} dia(s) (${cooldown.unlockDateStr}).`
      });
      return;
    }

    const cleanPassword = newDirectPassword.trim();
    if (cleanPassword.length < 6) {
      setPasswordModalMessage({
        type: 'error',
        text: 'A nova senha deve ter pelo menos 6 caracteres (exigência do Firebase Auth).'
      });
      return;
    }

    if (cleanPassword !== confirmDirectPassword.trim()) {
      setPasswordModalMessage({
        type: 'error',
        text: 'A confirmação de senha não confere.'
      });
      return;
    }

    const latestDb = getLatestUsersDb(usersDb);
    const existingRecord = latestDb[emailKey] || {
      email: emailKey,
      name: currentUser.name,
      role: currentUser.role || 'user'
    };

    if (existingRecord.password && String(existingRecord.password).trim() === cleanPassword) {
      setPasswordModalMessage({
        type: 'error',
        text: 'A nova senha deve ser diferente da senha atual.'
      });
      return;
    }

    setIsSavingPassword(true);

    try {
      if (isFirebaseConfigured() && firebaseAuth?.currentUser) {
        try {
          await updatePassword(firebaseAuth.currentUser, cleanPassword);
        } catch (fbAuthErr) {
          if (fbAuthErr?.code === 'auth/requires-recent-login' && googleProvider) {
            await reauthenticateWithPopup(firebaseAuth.currentUser, googleProvider);
            await updatePassword(firebaseAuth.currentUser, cleanPassword);
          }
        }
      }

      const nowTimestamp = Date.now();

      const updatedRecord = {
        ...existingRecord,
        email: emailKey,
        name: currentUser.name || existingRecord.name,
        role: currentUser.role || existingRecord.role || 'user',
        password: cleanPassword,
        customAdminPasswordSet: true,
        passwordUpdatedAt: nowTimestamp
      };

      if (isFirebaseConfigured()) {
        await withTimeout(
          setDoc(doc(firestoreDb, 'users', emailKey), updatedRecord, { merge: true }),
          2500
        ).catch(() => {});
      }

      const nextUsersDb = {
        ...latestDb,
        [emailKey]: updatedRecord
      };

      const nextCurrentUser = {
        ...currentUser,
        email: emailKey,
        passwordUpdatedAt: nowTimestamp
      };

      try {
        localStorage.setItem('cf_users_db_v5', JSON.stringify(nextUsersDb));
        localStorage.setItem('cf_current_user_v5', JSON.stringify(nextCurrentUser));
      } catch (err) {
        console.error(err);
      }

      setUsersDb(nextUsersDb);
      setCurrentUser(nextCurrentUser);
      setAuthPassword('');
      setNewDirectPassword('');
      setConfirmDirectPassword('');
      setPasswordModalMessage({
        type: 'success',
        text: 'Senha atualizada automaticamente no Firebase e no sistema! Próxima alteração liberada em 30 dias.'
      });
    } catch (error) {
      setPasswordModalMessage({
        type: 'error',
        text: 'Erro ao sincronizar senha com o Firebase. Tente novamente.'
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  // ==========================================
  // HANDLERS FINANCEIROS
  // ==========================================
  const handleSaveSalary = () => {
    const parsed = parseMaskedCurrency(salaryInput);
    setSalary(parsed);
    setSalaryInput(numberToMaskedCurrency(parsed));
    setIsEditingSalary(false);
  };

  const handleSaveCard = (e) => {
    e.preventDefault();
    if (!newCardName.trim()) return;
    const limitVal = parseMaskedCurrency(newCardLimit);
    const closeDay = Math.min(31, Math.max(1, parseInt(newCardClosingDay, 10) || 1));
    const dueDay = Math.min(31, Math.max(1, parseInt(newCardDueDay, 10) || 10));

    if (editingCardId) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === editingCardId
            ? { ...c, name: newCardName.trim(), limit: limitVal, closingDay: closeDay, dueDay }
            : c
        )
      );
      setEditingCardId(null);
    } else {
      const created = {
        id: `card-${Date.now()}`,
        name: newCardName.trim(),
        limit: limitVal,
        closingDay: closeDay,
        dueDay
      };
      setCards((prev) => [...prev, created]);
      setSelectedCardId(created.id);
    }

    setNewCardName('');
    setNewCardLimit('');
    setNewCardClosingDay('1');
    setNewCardDueDay('10');
  };

  const handleStartEditCard = (card) => {
    setEditingCardId(card.id);
    setNewCardName(card.name);
    setNewCardLimit(numberToMaskedCurrency(card.limit));
    setNewCardClosingDay(String(card.closingDay || 1));
    setNewCardDueDay(String(card.dueDay || 10));
  };

  const handleDeleteCard = (id) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (editingCardId === id) {
      setEditingCardId(null);
      setNewCardName('');
      setNewCardLimit('');
    }
  };

  const handleCreateCategory = (e) => {
    e.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) return;
    if (!allCategories.includes(clean)) {
      setCustomCategories((prev) => [...prev, clean]);
    }
    setExpCategory(clean);
    setNewCategoryName('');
    setShowCategoryCreator(false);
  };

  const handleAddFixedExpense = (e) => {
    e.preventDefault();
    if (!fixedNameInput.trim()) return;
    const val = parseMaskedCurrency(fixedAmountInput);
    if (val <= 0) return;

    if (editingFixedId) {
      setFixedExpenses((prev) =>
        prev.map((f) =>
          f.id === editingFixedId ? { ...f, name: fixedNameInput.trim(), amount: val } : f
        )
      );
      setEditingFixedId(null);
    } else {
      setFixedExpenses((prev) => [
        ...prev,
        { id: `fix-${Date.now()}`, name: fixedNameInput.trim(), amount: val }
      ]);
    }
    setFixedNameInput('');
    setFixedAmountInput('');
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!expWhat.trim()) return;
    const val = parseMaskedCurrency(expAmount);
    if (val <= 0) return;

    const isCredit = expPaymentMethod === 'credit';
    const installmentsCount = isCredit ? Math.max(1, parseInt(expInstallments, 10) || 1) : 1;
    const targetCardId = isCredit ? expCardId || selectedCardId : null;
    const targetCard = isCredit ? cards.find((c) => c.id === targetCardId) : null;

    const autoStartCycle =
      isCredit && targetCard && isCardClosedToday(targetCard)
        ? sanitizeCycle(currentCycle) + 1
        : sanitizeCycle(currentCycle);

    const combinedWhat =
      isMultiPurchase && multiItemsText.trim()
        ? `${expWhat.trim()}, ${multiItemsText.trim()}`
        : expWhat.trim();

    const cleanWhere = expWhere.trim() || 'Não informado';

    if (isMultiPurchase && isCredit) {
      const existingSamePurchase = expenses.find(
        (item) =>
          item.paymentMethod === 'credit' &&
          item.cardId === targetCardId &&
          item.installments === installmentsCount &&
          sanitizeCycle(item.startCycle) === autoStartCycle &&
          item.where.trim().toLowerCase() === cleanWhere.toLowerCase()
      );

      if (existingSamePurchase) {
        setExpenses((prev) =>
          prev.map((item) =>
            item.id === existingSamePurchase.id
              ? {
                  ...item,
                  what: `${item.what}, ${combinedWhat}`,
                  amount: val
                }
              : item
          )
        );
        setExpWhat('');
        setMultiItemsText('');
        setIsMultiPurchase(false);
        setExpWhere('');
        setExpAmount('');
        setExpInstallments(1);
        return;
      }
    }

    const newExp = {
      id: `exp-${Date.now()}`,
      what: combinedWhat,
      where: cleanWhere,
      amount: val,
      category: expCategory,
      paymentMethod: expPaymentMethod,
      cardId: targetCardId,
      installments: installmentsCount,
      startCycle: autoStartCycle
    };

    setExpenses((prev) => [newExp, ...prev]);
    setExpWhat('');
    setMultiItemsText('');
    setIsMultiPurchase(false);
    setExpWhere('');
    setExpAmount('');
    setExpInstallments(1);
  };

  const openEditExpenseModal = (exp) => {
    setEditingExpense(exp);
    setEditExpWhat(exp.what);
    setEditExpWhere(exp.where);
    setEditExpAmount(numberToMaskedCurrency(exp.amount));
    setEditExpCategory(exp.category || 'Outros');
    setEditExpPaymentMethod(exp.paymentMethod || 'pix');
    setEditExpCardId(exp.cardId || (cards[0] ? cards[0].id : ''));
    setEditExpInstallments(exp.installments || 1);
  };

  const handleSaveEditedExpense = (e) => {
    e.preventDefault();
    if (!editingExpense) return;
    const updatedAmount = parseMaskedCurrency(editExpAmount);
    if (updatedAmount <= 0) return;

    const isCredit = editExpPaymentMethod === 'credit';
    setExpenses((prev) =>
      prev.map((item) =>
        item.id === editingExpense.id
          ? {
              ...item,
              what: editExpWhat.trim() || item.what,
              where: editExpWhere.trim() || 'Não informado',
              amount: updatedAmount,
              category: editExpCategory,
              paymentMethod: editExpPaymentMethod,
              cardId: isCredit ? editExpCardId : null,
              installments: isCredit ? Math.max(1, parseInt(editExpInstallments, 10) || 1) : 1
            }
          : item
      )
    );
    setEditingExpense(null);
  };

  // ==========================================
  // LEITOR DE FATURA EM PDF
  // ==========================================
  const loadPdfJsLibrary = () => {
    return new Promise((resolve) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        resolve(window.pdfjsLib);
      };
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
    });
  };

  const parseInvoiceText = (rawText, fileName) => {
    const combinedSource = `${fileName} ${rawText}`.toLowerCase();

    let detectedCard = cards.find((c) => combinedSource.includes(c.name.toLowerCase()));
    if (!detectedCard) {
      if (combinedSource.includes('nubank') || combinedSource.includes('nu pagamentos')) {
        detectedCard = cards.find((c) => c.name.toLowerCase().includes('nu')) || cards[0];
      } else if (combinedSource.includes('mercado pago') || combinedSource.includes('mercadopago')) {
        detectedCard = cards.find((c) => c.name.toLowerCase().includes('mercado')) || cards[0];
      } else if (combinedSource.includes('itau') || combinedSource.includes('itaú')) {
        detectedCard = cards.find((c) => c.name.toLowerCase().includes('ita')) || cards[0];
      } else {
        detectedCard = selectedCard || cards[0];
      }
    }

    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 4);

    const ignoreKeywords = [
      'pagamento recebido',
      'total da fatura',
      'saldo anterior',
      'pagamento minimo',
      'pagamento mínimo',
      'limite total',
      'encargos',
      'resumo da fatura',
      'vencimento'
    ];

    const extractedItems = [];
    const valueRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\b/;
    const installmentRegex = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b|\bparcela\s*(\d{1,2})\s*de\s*(\d{1,2})\b/i;

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (ignoreKeywords.some((kw) => lower.includes(kw))) return;

      const valMatch = line.match(valueRegex);
      if (!valMatch) return;

      const parsedVal = parseMaskedCurrency(valMatch[1]);
      if (parsedVal <= 0 || parsedVal > 100000) return;

      let currentInst = 1;
      let totalInst = 1;
      const instMatch = line.match(installmentRegex);
      if (instMatch) {
        currentInst = parseInt(instMatch[1] || instMatch[3], 10) || 1;
        totalInst = parseInt(instMatch[2] || instMatch[4], 10) || 1;
        if (currentInst > totalInst || totalInst > 48) {
          currentInst = 1;
          totalInst = 1;
        }
      }

      let description = line
        .replace(valMatch[0], '')
        .replace(installmentRegex, '')
        .replace(/^\d{1,2}\s*[\/\-]\s*\d{1,2}(\s*[\/\-]\s*\d{2,4})?\s*/, '')
        .replace(/^\d{1,2}\s+[A-Za-zçÇ]{3}\s+/i, '')
        .replace(/[R$]/g, '')
        .trim();

      if (description.length < 2) description = 'Consumo Cartão';

      const totalPurchaseAmount = Number((parsedVal * totalInst).toFixed(2));

      extractedItems.push({
        id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        what: description.slice(0, 45),
        where: detectedCard ? `Fatura ${detectedCard.name}` : 'Fatura PDF',
        installmentAmount: parsedVal,
        totalAmount: totalPurchaseAmount,
        currentInstallment: currentInst,
        totalInstallments: totalInst,
        category: 'Compras'
      });
    });

    if (extractedItems.length === 0) {
      extractedItems.push({
        id: `pdf-${Date.now()}-1`,
        what: `Consumo Fatura (${fileName.replace(/\.pdf$/i, '')})`,
        where: detectedCard ? detectedCard.name : 'Cartão',
        installmentAmount: 100.0,
        totalAmount: 100.0,
        currentInstallment: 1,
        totalInstallments: 1,
        category: 'Compras'
      });
    }

    return {
      cardId: detectedCard ? detectedCard.id : '',
      cardName: detectedCard ? detectedCard.name : 'Cartão de Crédito',
      items: extractedItems.slice(0, 25)
    };
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsReadingPdf(true);

    try {
      let fullText = '';
      const pdfjsLib = await loadPdfJsLibrary();
      if (pdfjsLib) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const strings = content.items.map((item) => item.str);
          fullText += strings.join(' ') + '\n';
        }
      } else {
        fullText = await file.text();
      }

      const result = parseInvoiceText(fullText, file.name);
      setPdfConfirmModal(result);
    } catch (err) {
      const fallback = parseInvoiceText('', file.name);
      setPdfConfirmModal(fallback);
    } finally {
      setIsReadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleConfirmPdfImport = () => {
    if (!pdfConfirmModal) return;
    const targetCardId = pdfConfirmModal.cardId || selectedCardId;
    const activeCycle = sanitizeCycle(currentCycle);

    const importedExpenses = pdfConfirmModal.items.map((item) => {
      const calculatedStartCycle = activeCycle - (item.currentInstallment - 1);
      return {
        id: item.id,
        what: item.what,
        where: item.where,
        amount: item.totalAmount,
        category: item.category || 'Compras',
        paymentMethod: 'credit',
        cardId: targetCardId,
        installments: item.totalInstallments,
        startCycle: calculatedStartCycle
      };
    });

    setExpenses((prev) => [...importedExpenses, ...prev]);
    setPdfConfirmModal(null);
  };

  // ==========================================
  // TELA DE LOGIN / CADASTRO
  // ==========================================
  if (!currentUser) {
    return (
      <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#070b14] text-slate-100 flex items-center justify-center p-4 select-none cursor-default relative">
        <div className="fixed inset-0 bg-[#070b14] -z-10 pointer-events-none" />
        <div className="w-full max-w-md bg-[#0f172a] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Controle Financeiro</h1>
              <p className="text-xs text-slate-400">Gerencie salários, cartões, parcelas e ciclos</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-[#090d16] rounded-xl mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                authMode === 'login'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Entrar com Senha
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                authMode === 'register'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Criar Conta / Google
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Seu Nome</label>
                <input
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Ex: Andrey Dutra"
                  className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none cursor-text"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">E-mail</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none cursor-text"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                {authMode === 'register'
                  ? 'Defina uma Senha (para entrar direto sem pop-up)'
                  : 'Senha'}
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none cursor-text"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              {authMode === 'login' ? 'Entrar no Sistema' : 'Cadastrar com E-mail e Senha'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px bg-slate-800 flex-1" />
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">
              ou acesse com Google
            </span>
            <div className="h-px bg-slate-800 flex-1" />
          </div>

          <button
            type="button"
            onClick={handleGoogleButtonClick}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-2.5 transition shadow cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"
              />
            </svg>
            <span>
              {authMode === 'register'
                ? 'Cadastrar com Google (Vincular Senha)'
                : 'Entrar com Google'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  const isSuperAdmin =
    currentUser?.role === 'superadmin' || currentUser?.email === 'dumaster@teste.com';

  // ==========================================
  // DASHBOARD PRINCIPAL
  // ==========================================
  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#070b14] text-slate-100 select-none cursor-default pb-28 sm:pb-12 relative">
      {/* Camada fixa para impedir fundo branco no overscroll do iOS/Android */}
      <div className="fixed inset-0 bg-[#070b14] -z-10 pointer-events-none" />

      {/* HEADER */}
      <header className="border-b border-slate-800/80 bg-[#0b1120]/95 backdrop-blur sticky top-0 z-30 w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-lg font-bold text-white tracking-tight truncate">
                    Controle Financeiro
                  </h1>
                  {isSuperAdmin && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
                      <Shield className="w-3 h-3" /> SuperAdmin
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">Olá, {currentUser.name}</p>
              </div>
            </div>

            {/* Ações rápidas visíveis na primeira linha no celular */}
            <div className="flex sm:hidden items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => pdfInputRef.current && pdfInputRef.current.click()}
                disabled={isReadingPdf}
                className="px-2.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isReadingPdf ? 'Lendo...' : 'Fatura PDF'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPasswordModalMessage({ type: '', text: '' });
                  setNewDirectPassword('');
                  setConfirmDirectPassword('');
                  setShowPasswordModal(true);
                }}
                className="p-2 rounded-xl bg-[#0f172a] hover:bg-slate-800 border border-slate-800 text-slate-300 transition cursor-pointer"
                title="Trocar Senha de Acesso"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
              </button>

              <button
                type="button"
                onClick={() => handleLogout()}
                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition cursor-pointer"
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* CONTROLES DO HEADER: CICLO MENSAL + LEITOR PDF + SUPERADMIN + LOGOUT */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Navegador Dinâmico de Ciclos (Mês Anterior / Mês Atual / Virar Mês) */}
            <div className="flex flex-wrap items-center justify-between flex-1 sm:flex-initial gap-1 bg-[#0f172a] border border-slate-800 rounded-xl p-1 sm:p-1.5 shadow-inner min-w-0">
              <button
                type="button"
                onClick={() => setCurrentCycle((prev) => sanitizeCycle(prev) - 1)}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 hover:text-white text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
                title="Voltar 1 Mês"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mês Anterior</span>
              </button>

              <div className="px-1.5 sm:px-3 py-0.5 text-center min-w-[110px] sm:min-w-[140px] flex-1 sm:flex-initial">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    {sanitizeCycle(currentCycle) === 0
                      ? 'Mês Atual'
                      : sanitizeCycle(currentCycle) > 0
                      ? `+${sanitizeCycle(currentCycle)} ${
                          sanitizeCycle(currentCycle) === 1 ? 'mês à frente' : 'meses à frente'
                        }`
                      : `${sanitizeCycle(currentCycle)} ${
                          sanitizeCycle(currentCycle) === -1 ? 'mês atrás' : 'meses atrás'
                        }`}
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs font-extrabold text-emerald-400 block leading-tight truncate">
                  {getCycleLabel(currentCycle)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentCycle((prev) => sanitizeCycle(prev) + 1)}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
                title="Avançar 1 Mês"
              >
                <span>Virar Mês</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {sanitizeCycle(currentCycle) !== 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentCycle(0)}
                  className="w-full sm:w-auto mt-1 sm:mt-0 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Retornar imediatamente para o mês atual"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Voltar ao Atual</span>
                </button>
              )}
            </div>

            {/* Input oculto para leitura de PDF */}
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />

            {/* Botões Desktop */}
            <button
              type="button"
              onClick={() => pdfInputRef.current && pdfInputRef.current.click()}
              disabled={isReadingPdf}
              className="hidden sm:flex px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold items-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isReadingPdf ? 'Lendo PDF...' : 'Ler Fatura PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPasswordModalMessage({ type: '', text: '' });
                setNewDirectPassword('');
                setConfirmDirectPassword('');
                setShowPasswordModal(true);
              }}
              className="hidden sm:flex px-2.5 py-2 rounded-xl bg-[#0f172a] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium items-center gap-1.5 transition cursor-pointer"
              title="Trocar Senha de Acesso"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Trocar Senha</span>
            </button>

            {/* Seletor Prévia / Usuários / Código APENAS para o SuperAdmin */}
            {isSuperAdmin && (
              <div className="flex items-center justify-center w-full sm:w-auto bg-[#0f172a] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'preview'
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Prévia</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('admin')}
                  className={`flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'admin'
                      ? 'bg-slate-800 text-amber-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('code')}
                  className={`flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'code'
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Código</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleLogout()}
              className="hidden sm:flex p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-5 sm:space-y-6">
        {isSuperAdmin && viewMode === 'admin' ? (
          <div className="bg-[#0f172a] border border-amber-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">
                  Painel SuperAdmin — Gerenciamento de Contas
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Total de usuários: {Object.keys(usersDb).length}
              </span>
            </div>

            {adminFeedback && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{adminFeedback}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(usersDb).map((u) => {
                const isMainAdmin =
                  u.role === 'superadmin' || u.email === 'dumaster@teste.com';
                const isEditingThisUser = adminEditingEmail === u.email;
                const isDeletingThisUser = adminDeletingEmail === u.email;

                return (
                  <div
                    key={u.email}
                    className="bg-[#090d16] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{u.name}</p>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                              isMainAdmin
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {isMainAdmin ? 'SuperAdmin' : 'Usuário'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 break-all">{u.email}</p>

                      {/* Edição de Nome do Usuário */}
                      {isEditingThisUser && (
                        <div className="mt-3 p-2.5 rounded-xl bg-[#0f172a] border border-emerald-500/40 space-y-2">
                          <label className="block text-[10px] text-emerald-300 font-semibold">
                            Alterar Nome do Usuário:
                          </label>
                          <input
                            type="text"
                            value={adminEditNameInput}
                            onChange={(e) => setAdminEditNameInput(e.target.value)}
                            placeholder="Novo nome..."
                            className="w-full bg-[#070b14] border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none cursor-text"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAdminEditingEmail(null);
                                setAdminEditNameInput('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminUpdateUserName(u.email)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white cursor-pointer"
                            >
                              Salvar Nome
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Confirmação de Exclusão da Conta */}
                      {isDeletingThisUser && !isMainAdmin && (
                        <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 space-y-2">
                          <p className="text-[11px] text-rose-200 font-medium">
                            Tem certeza que deseja excluir a conta de <strong>{u.name}</strong>?
                          </p>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAdminDeletingEmail(null)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminDeleteUser(u.email)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-bold text-white cursor-pointer"
                            >
                              Confirmar Exclusão
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAdminDeletingEmail(null);
                            setAdminEditingEmail(u.email);
                            setAdminEditNameInput(u.name || '');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[11px] font-semibold text-emerald-400 flex items-center gap-1 transition cursor-pointer"
                          title="Alterar Nome do Usuário"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Editar Nome</span>
                        </button>

                        {!isMainAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminEditingEmail(null);
                              setAdminDeletingEmail(u.email);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[11px] font-semibold text-rose-400 flex items-center gap-1 transition cursor-pointer"
                            title="Excluir Conta do Usuário"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCurrentUser({ email: u.email, name: u.name, role: u.role });
                          setViewMode('preview');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition cursor-pointer"
                      >
                        Acessar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isSuperAdmin && viewMode === 'code' ? (
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-emerald-400 mb-3">
              Inspeção de Dados (Exclusivo SuperAdmin)
            </h2>
            <pre className="text-xs text-slate-300 bg-[#070b14] p-4 rounded-xl overflow-x-auto select-text cursor-text">
              {JSON.stringify(
                { currentUser, currentCycle, salary, cards, fixedExpenses, expenses },
                null,
                2
              )}
            </pre>
          </div>
        ) : (
          <>
            {/* LINHA SUPERIOR: 3 PAINÉIS COMPACTOS IGUAIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. PAINEL DE SALÁRIO */}
              <div className="bg-[#0f172a] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-sm font-bold text-white">Painel de Salário</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSalaryInput(numberToMaskedCurrency(salary));
                        setIsEditingSalary(!isEditingSalary);
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{isEditingSalary ? 'Fechar' : 'Editar'}</span>
                    </button>
                  </div>

                  <div className="bg-[#092222]/70 border border-emerald-500/25 rounded-xl p-4 mb-4">
                    {isEditingSalary ? (
                      <div>
                        <label className="block text-[11px] text-emerald-300/80 mb-1">
                          Digite seu Salário Mensal (R$):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={salaryInput}
                            onChange={(e) => setSalaryInput(formatInputCurrency(e.target.value))}
                            placeholder="0,00"
                            className="w-full bg-[#070b14] border border-emerald-500/50 rounded-lg px-3 py-1.5 text-lg font-bold text-emerald-400 outline-none cursor-text"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveSalary}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-400 mb-1">Saldo Livre Estimado</p>
                        <p
                          className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                            financialSummary.freeBalance >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {formatBRL(financialSummary.freeBalance)}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Salário Informado:</span>
                  <span className="font-bold text-white">{formatBRL(salary)}</span>
                </div>
              </div>

              {/* 2. PAINEL DE CARTÕES DE CRÉDITO */}
              <div className="bg-[#0f172a] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-400" />
                      <h2 className="text-sm font-bold text-white">Cartões de Crédito</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingCards(!isEditingCards)}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{isEditingCards ? 'Concluir' : 'Editar'}</span>
                    </button>
                  </div>

                  <div className="relative mb-3">
                    <select
                      value={selectedCard?.id || ''}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                      className="w-full appearance-none bg-[#161f33] hover:bg-[#1c2740] border border-slate-700/80 hover:border-purple-500/60 focus:border-purple-500 rounded-xl px-3.5 py-2 pr-9 text-xs font-semibold text-white outline-none transition cursor-pointer"
                    >
                      {cards.map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#0f172a] text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-purple-300 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>

                  {selectedCard ? (
                    <div className="bg-[#1e1533]/80 border border-purple-500/30 rounded-xl p-3.5 mb-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] text-slate-300">
                          Limite Disponível ({selectedCard.name})
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {isCardClosedToday(selectedCard)
                            ? 'Compras p/ próx. mês'
                            : 'Fatura aberta'}
                        </span>
                      </div>
                      <p className="text-2xl font-extrabold text-purple-400 tracking-tight">
                        {formatBRL(
                          Math.max(
                            0,
                            (Number(selectedCard.limit) || 0) -
                              (financialSummary.cardUsageMap[selectedCard.id] || 0)
                          )
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-purple-400" />
                        <span>
                          Fecha dia {selectedCard.closingDay || 1} • Vence dia{' '}
                          {selectedCard.dueDay || 10}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-3 text-xs text-slate-400 text-center">
                      Nenhum cartão cadastrado. Clique em Editar.
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Limite Cartão:{' '}
                    <strong className="text-white">
                      {formatBRL(selectedCard ? selectedCard.limit : 0)}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    Em Uso:{' '}
                    <strong className="text-rose-400">
                      {formatBRL(
                        selectedCard ? financialSummary.cardUsageMap[selectedCard.id] || 0 : 0
                      )}
                    </strong>
                  </span>
                </div>
              </div>

              {/* 3. PAINEL TOTAL DE GASTOS */}
              <div className="bg-[#0f172a] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                      <h2 className="text-sm font-bold text-white">Total de Gastos</h2>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {getCycleLabel(currentCycle)}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Despesas Fixas:</span>
                      <span className="font-semibold text-white">
                        {formatBRL(financialSummary.totalFixed)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Parcelas do Mês:</span>
                      <span className="font-semibold text-white">
                        {formatBRL(financialSummary.monthlyInstallmentsTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Acumulado Restante:</span>
                      <span className="font-semibold text-white">
                        {formatBRL(financialSummary.totalRemainingAccumulated)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Comprometido:</span>
                  <span className="text-sm font-extrabold text-rose-400">
                    {formatBRL(financialSummary.totalCommittedMonth)}
                  </span>
                </div>
              </div>
            </div>

            {/* GERENCIAMENTO DE CARTÕES */}
            {isEditingCards && (
              <div className="bg-[#0f172a] border border-purple-500/40 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Gerenciar Cartões, Limites e Datas de Fechamento/Vencimento</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditingCards(false)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>

                <form
                  onSubmit={handleSaveCard}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4"
                >
                  <input
                    type="text"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    placeholder="Nome (ex: Nubank)"
                    className="bg-[#090d16] border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newCardLimit}
                    onChange={(e) => setNewCardLimit(formatInputCurrency(e.target.value))}
                    placeholder="Limite Total (R$)"
                    className="bg-[#090d16] border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                  />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newCardClosingDay}
                    onChange={(e) => setNewCardClosingDay(e.target.value)}
                    placeholder="Dia Fechamento (1-31)"
                    title="Dia de Fechamento da Fatura"
                    className="bg-[#090d16] border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                  />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newCardDueDay}
                    onChange={(e) => setNewCardDueDay(e.target.value)}
                    placeholder="Dia Vencimento (1-31)"
                    title="Dia de Vencimento da Fatura"
                    className="bg-[#090d16] border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                  />
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl py-2 px-4 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{editingCardId ? 'Atualizar Cartão' : 'Adicionar Cartão'}</span>
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {cards.map((c) => (
                    <div
                      key={c.id}
                      className="bg-[#090d16] border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">{c.name}</p>
                        <p className="text-[11px] text-slate-400">
                          Limite: {formatBRL(c.limit)} • Fecha dia {c.closingDay || 1} / Vence dia{' '}
                          {c.dueDay || 10}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditCard(c)}
                          className="p-1.5 text-slate-400 hover:text-purple-400 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(c.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LINHA CENTRAL */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* ESQUERDA: REGISTRAR NOVO GASTO */}
              <div className="lg:col-span-4 min-w-0 bg-[#0f172a] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-sm font-bold text-white">Registrar Novo Gasto</h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCategoryCreator(!showCategoryCreator)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nova Categoria</span>
                    </button>
                  </div>

                  {showCategoryCreator && (
                    <form
                      onSubmit={handleCreateCategory}
                      className="mb-4 p-3 rounded-xl bg-[#090d16] border border-emerald-500/30 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nome da nova categoria..."
                        className="w-full bg-transparent text-xs text-white outline-none cursor-text"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Salvar
                      </button>
                    </form>
                  )}

                  <form onSubmit={handleAddExpense} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        O que foi gasto?
                      </label>
                      <input
                        type="text"
                        value={expWhat}
                        onChange={(e) => setExpWhat(e.target.value)}
                        placeholder="Ex: Supermercado, Teclado..."
                        className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                      />

                      {expWhat.trim().length > 0 && (
                        <div className="mt-2 p-2.5 rounded-xl bg-[#090d16]/90 border border-slate-800/90 space-y-2">
                          <button
                            type="button"
                            onClick={() => setIsMultiPurchase(!isMultiPurchase)}
                            className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                          >
                            {isMultiPurchase ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                            <span>Foi uma compra múltipla no mesmo uso do cartão?</span>
                          </button>

                          {isMultiPurchase && (
                            <input
                              type="text"
                              value={multiItemsText}
                              onChange={(e) => setMultiItemsText(e.target.value)}
                              placeholder="Outros itens da mesma compra (ex: Mouse, Cabo...)"
                              className="w-full bg-[#0f172a] border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-text"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Onde foi gasto?
                      </label>
                      <input
                        type="text"
                        value={expWhere}
                        onChange={(e) => setExpWhere(e.target.value)}
                        placeholder="Ex: Aliexpress, Carrefour..."
                        className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Valor Total (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={expAmount}
                        onChange={(e) => setExpAmount(formatInputCurrency(e.target.value))}
                        placeholder="0,00"
                        className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-white outline-none cursor-text"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Categoria</label>
                      <div className="relative">
                        <select
                          value={expCategory}
                          onChange={(e) => setExpCategory(e.target.value)}
                          className="w-full appearance-none bg-[#090d16] hover:bg-[#131c2e] border border-slate-800 hover:border-emerald-500/60 focus:border-emerald-500 rounded-xl px-3.5 py-2 pr-9 text-xs text-white outline-none transition cursor-pointer"
                        >
                          {allCategories.map((cat) => (
                            <option key={cat} value={cat} className="bg-[#0f172a] text-white">
                              {cat}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-emerald-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        Forma de Pagamento
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'pix', label: 'Pix' },
                          { id: 'debit', label: 'Débito' },
                          { id: 'credit', label: 'Crédito' }
                        ].map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setExpPaymentMethod(method.id)}
                            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                              expPaymentMethod === method.id
                                ? method.id === 'credit'
                                  ? 'bg-purple-600 border-purple-500 text-white shadow'
                                  : 'bg-emerald-600 border-emerald-500 text-white shadow'
                                : 'bg-[#090d16] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {expPaymentMethod === 'credit' && (
                      <div className="p-3 rounded-xl bg-[#18112b] border border-purple-500/30 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] text-purple-300 mb-1">
                              Selecione o Cartão
                            </label>
                            <div className="relative">
                              <select
                                value={expCardId}
                                onChange={(e) => setExpCardId(e.target.value)}
                                className="w-full appearance-none bg-[#090d16] hover:bg-[#141d30] border border-purple-500/40 hover:border-purple-400 rounded-lg px-2.5 py-1.5 pr-7 text-xs text-white outline-none transition cursor-pointer"
                              >
                                {cards.map((c) => (
                                  <option key={c.id} value={c.id} className="bg-[#0f172a]">
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-purple-300 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] text-purple-300 mb-1">
                              Parcelas
                            </label>
                            <div className="relative">
                              <select
                                value={expInstallments}
                                onChange={(e) => setExpInstallments(Number(e.target.value))}
                                className="w-full appearance-none bg-[#090d16] hover:bg-[#141d30] border border-purple-500/40 hover:border-purple-400 rounded-lg px-2.5 py-1.5 pr-7 text-xs text-white outline-none transition cursor-pointer"
                              >
                                {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                                  <option key={num} value={num} className="bg-[#0f172a]">
                                    {num === 1 ? '1x (À vista)' : `${num}x parcelas`}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-purple-300 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Lançar Gasto</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* DIREITA: HISTÓRICO DE GASTOS, TOTAL E PARCELAS */}
              <div className="lg:col-span-8 min-w-0 bg-[#0f172a] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between min-h-[320px] max-h-[460px] lg:max-h-none lg:h-auto shadow-lg">
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <h2 className="text-sm font-bold text-white">
                        Histórico de Gastos, Total e Parcelas
                      </h2>
                    </div>
                    <span className="text-xs text-slate-400">
                      Exibindo: <strong className="text-emerald-400">{getCycleLabel(currentCycle)}</strong>
                    </span>
                  </div>

                  <div className="overflow-y-auto overflow-x-auto flex-1 pr-1">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                          <th className="pb-2.5 font-medium">O que foi gasto</th>
                          <th className="pb-2.5 font-medium">Onde</th>
                          <th className="pb-2.5 font-medium">Categoria</th>
                          <th className="pb-2.5 font-medium">Pagamento</th>
                          <th className="pb-2.5 font-medium">Parcelas</th>
                          <th className="pb-2.5 font-medium">Total</th>
                          <th className="pb-2.5 font-medium text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs">
                        {processedExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-16 text-center text-slate-500">
                              Nenhum gasto ativo neste ciclo mensal.
                            </td>
                          </tr>
                        ) : (
                          processedExpenses.map((exp) => {
                            const cardObj = cards.find((c) => c.id === exp.cardId);
                            const isPaid = exp.status === 'paid';
                            const isScheduled = exp.status === 'scheduled';

                            return (
                              <tr
                                key={exp.id}
                                className={`transition ${
                                  isPaid ? 'opacity-60 bg-slate-900/30' : 'hover:bg-slate-800/30'
                                }`}
                              >
                                <td
                                  className={`py-3 font-semibold ${
                                    isPaid ? 'line-through text-slate-400' : 'text-white'
                                  }`}
                                >
                                  {exp.what}
                                </td>
                                <td className="py-3 text-slate-400">{exp.where}</td>
                                <td className="py-3">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]">
                                    {exp.category}
                                  </span>
                                </td>
                                <td className="py-3 text-slate-300">
                                  {exp.paymentMethod === 'credit'
                                    ? `Cartão: ${cardObj ? cardObj.name : 'Crédito'}`
                                    : exp.paymentMethod === 'debit'
                                    ? 'Cartão de Débito'
                                    : 'Pix'}
                                </td>
                                <td className="py-3">
                                  {isPaid ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                                      <Check className="w-3 h-3" />
                                      Quitado ({exp.installments}/{exp.installments})
                                    </span>
                                  ) : isScheduled ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-semibold">
                                      Próx. Fatura (1/{exp.installments} de{' '}
                                      {formatBRL(exp.installmentValue)})
                                    </span>
                                  ) : exp.installments > 1 ? (
                                    <span className="text-amber-400 font-semibold">
                                      {exp.currentInstallmentNumber}/{exp.installments} de{' '}
                                      <strong className="text-white">
                                        {formatBRL(exp.installmentValue)}
                                      </strong>
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">
                                      1/1 (À vista: {formatBRL(exp.amount)})
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 font-bold text-white">
                                  {isPaid ? (
                                    <span className="text-emerald-400">{formatBRL(0)}</span>
                                  ) : (
                                    formatBRL(exp.remainingAmount)
                                  )}
                                </td>
                                <td className="py-3 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditExpenseModal(exp)}
                                      className="p-1.5 text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                                      title="Editar Gasto"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpenses((prev) => prev.filter((i) => i.id !== exp.id))
                                      }
                                      className="p-1.5 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                      title="Excluir Gasto"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* LINHA INFERIOR: DESPESAS FIXAS */}
            <div className="bg-[#0f172a] border border-slate-800/90 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-bold text-white">Despesas Fixas</h2>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {formatBRL(financialSummary.totalFixed)}
                </span>
              </div>

              <form
                onSubmit={handleAddFixedExpense}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4"
              >
                <input
                  type="text"
                  value={fixedNameInput}
                  onChange={(e) => setFixedNameInput(e.target.value)}
                  placeholder="Aluguel, Luz, Academia..."
                  className="flex-1 bg-[#090d16] border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-text"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={fixedAmountInput}
                  onChange={(e) => setFixedAmountInput(formatInputCurrency(e.target.value))}
                  placeholder="Valor (R$)"
                  className="w-full sm:w-44 bg-[#090d16] border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-text"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingFixedId ? 'Salvar' : 'Adicionar'}</span>
                </button>
              </form>

              {fixedExpenses.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma despesa fixa cadastrada.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {fixedExpenses.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#090d16] border border-slate-800/90 rounded-xl px-4 py-3 flex items-center justify-between"
                    >
                      <span className="text-xs font-medium text-white">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {formatBRL(item.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFixedId(item.id);
                            setFixedNameInput(item.name);
                            setFixedAmountInput(numberToMaskedCurrency(item.amount));
                          }}
                          className="p-1 text-slate-400 hover:text-blue-400 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFixedExpenses((prev) => prev.filter((f) => f.id !== item.id))
                          }
                          className="p-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* CARD (MODAL) DE EDIÇÃO DE GASTO NO HISTÓRICO */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Editar Gasto</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedExpense} className="space-y-3.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">O que foi gasto?</label>
                <input
                  type="text"
                  value={editExpWhat}
                  onChange={(e) => setEditExpWhat(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Onde foi gasto?</label>
                <input
                  type="text"
                  value={editExpWhere}
                  onChange={(e) => setEditExpWhere(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Valor Total (R$)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editExpAmount}
                  onChange={(e) => setEditExpAmount(formatInputCurrency(e.target.value))}
                  className="w-full bg-[#090d16] border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-bold text-emerald-400 outline-none cursor-text"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Categoria</label>
                <div className="relative">
                  <select
                    value={editExpCategory}
                    onChange={(e) => setEditExpCategory(e.target.value)}
                    className="w-full appearance-none bg-[#090d16] border border-slate-800 hover:border-emerald-500/60 rounded-xl px-3.5 py-2 pr-9 text-xs text-white outline-none cursor-pointer"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#0f172a]">
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-emerald-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Forma de Pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pix', label: 'Pix' },
                    { id: 'debit', label: 'Débito' },
                    { id: 'credit', label: 'Crédito' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEditExpPaymentMethod(m.id)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        editExpPaymentMethod === m.id
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-[#090d16] border-slate-800 text-slate-400'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {editExpPaymentMethod === 'credit' && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Cartão</label>
                    <div className="relative">
                      <select
                        value={editExpCardId}
                        onChange={(e) => setEditExpCardId(e.target.value)}
                        className="w-full appearance-none bg-[#090d16] border border-slate-800 rounded-xl px-3 py-2 pr-7 text-xs text-white outline-none cursor-pointer"
                      >
                        {cards.map((c) => (
                          <option key={c.id} value={c.id} className="bg-[#0f172a]">
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Parcelas</label>
                    <div className="relative">
                      <select
                        value={editExpInstallments}
                        onChange={(e) => setEditExpInstallments(Number(e.target.value))}
                        className="w-full appearance-none bg-[#090d16] border border-slate-800 rounded-xl px-3 py-2 pr-7 text-xs text-white outline-none cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n} className="bg-[#0f172a]">
                            {n === 1 ? '1x (À vista)' : `${n}x`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CARD DE CONFIRMAÇÃO DE LEITURA DE FATURA PDF */}
      {pdfConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0f172a] border border-purple-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Confirmação de Leitura de Fatura</h3>
                <p className="text-xs text-purple-300 font-medium mt-0.5">
                  Você está informando a fatura do{' '}
                  <strong>
                    {cards.find((c) => c.id === pdfConfirmModal.cardId)?.name ||
                      pdfConfirmModal.cardName}
                  </strong>{' '}
                  adicionando apenas os detalhes do consumo
                </p>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-[11px] text-slate-400 mb-1">
                Cartão de Crédito identificado:
              </label>
              <div className="relative">
                <select
                  value={pdfConfirmModal.cardId}
                  onChange={(e) =>
                    setPdfConfirmModal((prev) => ({ ...prev, cardId: e.target.value }))
                  }
                  className="w-full appearance-none bg-[#090d16] border border-purple-500/40 rounded-xl px-3.5 py-2 pr-9 text-xs font-semibold text-white outline-none cursor-pointer"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0f172a]">
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-purple-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto bg-[#090d16] border border-slate-800 rounded-xl p-3 mb-4 space-y-2">
              {pdfConfirmModal.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs border-b border-slate-800/70 pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-semibold text-white">{item.what}</p>
                    <p className="text-[11px] text-slate-400">
                      Parcela {item.currentInstallment}/{item.totalInstallments} de{' '}
                      {formatBRL(item.installmentAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-300">
                      Total: {formatBRL(item.totalAmount)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPdfConfirmModal((prev) => ({
                          ...prev,
                          items: prev.items.filter((_, i) => i !== idx)
                        }))
                      }
                      className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPdfConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPdfImport}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DEFINIÇÃO DE SENHA DIRETA (COM LIMITE DE 1 MÊS) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0f172a] border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Alterar Senha da Conta</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Altere a senha de acesso direto do usuário{' '}
              <strong className="text-white">{currentUser.email}</strong>. Após alterar, uma nova
              troca só poderá ser feita após <strong>1 mês (30 dias)</strong>.
            </p>

            {(() => {
              const cooldown = getPasswordCooldownInfo(currentUser.email);
              const showLockWarning = cooldown.isLocked && passwordModalMessage.type !== 'success';
              return (
                <>
                  {showLockWarning && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Limite de 1 mês ativo</p>
                        <p className="text-[11px] text-amber-200/90 mt-0.5">
                          Sua senha já foi alterada recentemente. Você poderá alterá-la novamente em{' '}
                          <strong>{cooldown.remainingDays} dia(s)</strong> (a partir de{' '}
                          <strong>{cooldown.unlockDateStr}</strong>).
                        </p>
                      </div>
                    </div>
                  )}

                  {passwordModalMessage.text && (
                    <div
                      className={`mb-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                        passwordModalMessage.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {passwordModalMessage.type === 'success' ? (
                        <Check className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{passwordModalMessage.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveDirectPassword} className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Nova Senha (mín. 6 caracteres)
                      </label>
                      <input
                        type="password"
                        disabled={cooldown.isLocked || isSavingPassword}
                        value={newDirectPassword}
                        onChange={(e) => setNewDirectPassword(e.target.value)}
                        placeholder={
                          cooldown.isLocked ? 'Bloqueado por 30 dias' : 'Mínimo de 6 caracteres'
                        }
                        className="w-full bg-[#090d16] disabled:opacity-50 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                        autoFocus={!cooldown.isLocked}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type="password"
                        disabled={cooldown.isLocked || isSavingPassword}
                        value={confirmDirectPassword}
                        onChange={(e) => setConfirmDirectPassword(e.target.value)}
                        placeholder={
                          cooldown.isLocked ? 'Bloqueado por 30 dias' : 'Repita sua nova senha'
                        }
                        className="w-full bg-[#090d16] disabled:opacity-50 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-text"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowPasswordModal(false)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                      >
                        Fechar
                      </button>
                      <button
                        type="submit"
                        disabled={cooldown.isLocked || isSavingPassword}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white cursor-pointer"
                      >
                        {isSavingPassword ? 'Sincronizando Firebase...' : 'Salvar Nova Senha'}
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
