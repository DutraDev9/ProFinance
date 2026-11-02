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
} from "lucide-react";

// Configuração do Firebase integrada diretamente no arquivo único
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

// Função para mascarar e formatar em tempo real para o formato brasileiro (ex: 2.544,62)
const maskCurrencyInput = (value) => {
  if (!value) return "";
  // Remove tudo que não for dígito
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";

  // Converte para número dividindo por 100 para considerar os 2 últimos dígitos como centavos
  const numberVal = Number(digits) / 100;

  // Formata com separador de milhar (.) e decimal (,)
  return numberVal.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Converte a string formatada em número puro para salvar no banco
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

  const [activeView, setActiveView] = useState("dashboard");

  const [salary, setSalary] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState("");

  const [fixedName, setFixedName] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [editingFixedId, setEditingFixedId] = useState(null);
  const [editFixedName, setEditFixedName] = useState("");
  const [editFixedAmount, setEditFixedAmount] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editCardName, setEditCardName] = useState("");
  const [editCardLimit, setEditCardLimit] = useState("");

  // Novos estados para o formulário de Gastos reformulado
  const [expWhat, setExpWhat] = useState("");
  const [expWhere, setExpWhere] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("Alimentação");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [customCategories, setCustomCategories] = useState(["Alimentação", "Transporte", "Lazer", "Saúde", "Educação"]);
  const [expPaymentMethod, setExpPaymentMethod] = useState("pix"); // 'pix', 'debito', 'credito'
  const [expCreditCardId, setExpCreditCardId] = useState("");
  const [expInstallments, setExpInstallments] = useState(1);

  // Estados de edição de gastos
  const [editingExpId, setEditingExpId] = useState(null);
  const [editExpWhat, setEditExpWhat] = useState("");
  const [editExpWhere, setEditExpWhere] = useState("");
  const [editExpAmount, setEditExpAmount] = useState("");
  const [editExpCategory, setEditExpCategory] = useState("Alimentação");
  const [editExpPaymentMethod, setEditExpPaymentMethod] = useState("pix");
  const [editExpCreditCardId, setEditExpCreditCardId] = useState("");
  const [editExpInstallments, setEditExpInstallments] = useState(1);

  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

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
      setSalaryInput(loadedSalary === 0 ? "" : (loadedSalary * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
      setFixedExpenses(data.fixedExpenses || []);
      setCards(data.cards || []);
      setExpenses(data.expenses || []);
    } else {
      const initialData = {
        name: firebaseUser.displayName || nameInput || "Usuário",
        email: firebaseUser.email,
        role: isSuperAdmin ? "superadmin" : "user",
        salary: 0,
        fixedExpenses: [],
        cards: [],
        expenses: [],
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, initialData);
      setUser({ uid: firebaseUser.uid, ...initialData });
      setSalary(0);
      setSalaryInput("");
      setFixedExpenses([]);
      setCards([]);
      setExpenses([]);
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
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setAuthError("Erro ao autenticar com o Google: " + err.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
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
    setEditFixedAmount((item.amount * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
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
    const updated = [
      ...cards,
      { id: Date.now().toString(), name: cardName.trim(), limit: parsedLimit },
    ];
    setCards(updated);
    setCardName("");
    setCardLimit("");
    await saveUserData({ cards: updated });
  };

  const startEditCard = (card) => {
    setEditingCardId(card.id);
    setEditCardName(card.name);
    setEditCardLimit((card.limit * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
  };

  const handleSaveCardEdit = async (id) => {
    if (!editCardName.trim()) return;
    const newName = editCardName.trim();
    const parsedLimit = parseMaskedCurrency(editCardLimit);
    const updatedCards = cards.map((c) => (c.id === id ? { ...c, name: newName, limit: parsedLimit } : c));
    const updatedExpenses = expenses.map((exp) => (exp.paymentSource === id ? { ...exp, paymentLabel: `${newName} (Crédito)` } : exp));
    setCards(updatedCards);
    setExpenses(updatedExpenses);
    setEditingCardId(null);
    await saveUserData({ cards: updatedCards, expenses: updatedExpenses });
  };

  const handleRemoveCard = async (id) => {
    const updated = cards.filter((c) => c.id !== id);
    setCards(updated);
    await saveUserData({ cards: updated });
  };

  // Funções de Registro de Gasto com novas condições
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expWhat.trim() || !expWhere.trim() || expAmount === "") return;

    let finalCategory = expCategory;
    let updatedCategories = customCategories;
    if (expCategory === "nova" && newCategoryInput.trim()) {
      finalCategory = newCategoryInput.trim();
      if (!customCategories.includes(finalCategory)) {
        updatedCategories = [...customCategories, finalCategory];
        setCustomCategories(updatedCategories);
      }
    }

    const total = parseMaskedCurrency(expAmount);
    let paymentLabel = "Pix / Débito";
    let paymentSource = expPaymentMethod;
    let installments = 1;

    if (expPaymentMethod === "pix") {
      paymentLabel = "Pix";
    } else if (expPaymentMethod === "debito") {
      paymentLabel = "Cartão de Débito";
    } else if (expPaymentMethod === "credito") {
      const selectedCard = cards.find((c) => c.id === expCreditCardId);
      paymentLabel = selectedCard ? `Cartão: ${selectedCard.name}` : "Cartão de Crédito";
      paymentSource = expCreditCardId || "credito";
      installments = Math.max(1, Number(expInstallments) || 1);
    }

    const installmentValue = installments > 1 ? total / installments : total;

    const newExpense = {
      id: Date.now().toString(),
      what: expWhat.trim(),
      where: expWhere.trim(),
      totalAmount: total,
      category: finalCategory,
      paymentMethod: expPaymentMethod,
      paymentSource,
      paymentLabel,
      installments,
      installmentValue,
      createdAt: new Date().toLocaleDateString("pt-BR"),
    };

    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    setExpWhat("");
    setExpWhere("");
    setExpAmount("");
    setExpCategory("Alimentação");
    setNewCategoryInput("");
    setExpPaymentMethod("pix");
    setExpCreditCardId("");
    setExpInstallments(1);
    await saveUserData({ expenses: updated, customCategories: updatedCategories });
  };

  const startEditExpense = (exp) => {
    setEditingExpId(exp.id);
    setEditExpWhat(exp.what);
    setEditExpWhere(exp.where);
    setEditExpAmount((exp.totalAmount * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
    setEditExpCategory(exp.category || "Alimentação");
    setEditExpPaymentMethod(exp.paymentMethod || "pix");
    setEditExpCreditCardId(exp.paymentSource || "");
    setEditExpInstallments(exp.installments || 1);
  };

  const handleSaveExpenseEdit = async (id) => {
    if (!editExpWhat.trim() || !editExpWhere.trim()) return;
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
      exp.id === id
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

  const handleRemoveExpense = async (id) => {
    const updated = expenses.filter((exp) => exp.id !== id);
    setExpenses(updated);
    await saveUserData({ expenses: updated });
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
  const totalExpenses = expenses.reduce((acc, item) => acc + (Number(item.totalAmount) || 0), 0);
  const totalMonthlyInstallments = expenses.reduce((acc, item) => acc + (Number(item.installmentValue) || 0), 0);
  const totalSpentMonth = totalFixed + totalMonthlyInstallments;
  const remainingSalary = salary - totalSpentMonth;

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
              <label className="block text-sm mb-1 text-slate-600 dark:text-slate-400 cursor-default">Senha</label>
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
            <span className="text-xs text-slate-400 cursor-default">OU</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-medium transition flex items-center justify-center gap-2 cursor-pointer"
          >
            Entrar com Google
          </button>

          <p className="mt-4 text-center text-sm text-slate-500 cursor-default">
            {isRegistering ? "Já possui conta?" : "Ainda não tem conta?"}{" "}
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold cursor-default">Controle Financeiro</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 cursor-default">
              Olá, {user.name} ({user.email})
            </p>
          </div>

          <div className="flex items-center gap-3">
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

            {user.role === "superadmin" && (
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
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer"
              title="Alternar tema"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
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

      {/* ABA DE CÓDIGO */}
      {viewMode === "code" ? (
        <main className="max-w-7xl mx-auto p-4 select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-bold mb-2 cursor-default">Código Atual (`src/App.jsx`)</h2>
            <p className="text-xs text-slate-500 mb-4 cursor-default">O código fonte está integrado em arquivo único sem dependências externas de serviços.</p>
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
        <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
          {/* COLUNA ESQUERDA */}
          <div className="lg:col-span-4 space-y-6">
            {/* SALÁRIO */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-500 cursor-default">
                  <Wallet size={20} />
                  <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Painel de Salário</h2>
                </div>
                {!isEditingSalary && (
                  <button
                    onClick={() => {
                      setSalaryInput(salary === 0 ? "" : (salary * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
                      setIsEditingSalary(true);
                    }}
                    className="flex items-center gap-1 text-xs text-emerald-500 hover:underline cursor-pointer"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                )}
              </div>

              {isEditingSalary ? (
                <form onSubmit={handleSaveSalary} className="space-y-2">
                  <label className="block text-xs text-slate-500 cursor-default">Digite seu salário (ex: digite 254462 para 2.544,62)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={salaryInput}
                      onChange={(e) => setSalaryInput(maskCurrencyInput(e.target.value))}
                      placeholder="0,00"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-base font-semibold"
                    />
                    <button type="submit" className="p-2 rounded-lg bg-emerald-600 text-white cursor-pointer" title="Salvar">
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingSalary(false)}
                      className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-pointer"
                      title="Cancelar"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  onClick={() => {
                    setSalaryInput(salary === 0 ? "" : (salary * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
                    setIsEditingSalary(true);
                  }}
                  className="cursor-pointer p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-emerald-500/40 transition"
                >
                  <span className="block text-xs text-slate-500 mb-0.5 cursor-pointer">Salário Atual (clique para editar)</span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white cursor-pointer">{formatBRL(salary)}</span>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-sm cursor-default">
                <span className="text-slate-500 cursor-default">Saldo livre estimado:</span>
                <span className={remainingSalary >= 0 ? "text-emerald-500 font-bold cursor-default" : "text-red-500 font-bold cursor-default"}>
                  {formatBRL(remainingSalary)}
                </span>
              </div>
            </section>

            {/* DESPESAS FIXAS */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-blue-500 cursor-default">
                  <Home size={20} />
                  <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Despesas Fixas</h2>
                </div>
                <span className="text-sm font-semibold text-slate-500 cursor-default">{formatBRL(totalFixed)}</span>
              </div>

              <form onSubmit={handleAddFixed} className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Aluguel, Luz, Academia..."
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <input
                  type="text"
                  placeholder="Valor"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(maskCurrencyInput(e.target.value))}
                  className="w-28 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <button type="submit" className="p-2 rounded-lg bg-blue-600 text-white cursor-pointer" title="Adicionar">
                  <Plus size={18} />
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {fixedExpenses.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2 cursor-default">Nenhuma despesa fixa cadastrada.</p>
                ) : (
                  fixedExpenses.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm">
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
                            className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
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
                          <span className="cursor-default">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium cursor-default">
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

            {/* TOTAL DE GASTOS */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3 text-rose-500 cursor-default">
                <TrendingDown size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Total de Gastos</h2>
              </div>
              <div className="space-y-2 text-sm cursor-default">
                <div className="flex justify-between cursor-default">
                  <span className="text-slate-500 cursor-default">Despesas Fixas:</span>
                  <span className="font-medium cursor-default">{formatBRL(totalFixed)}</span>
                </div>
                <div className="flex justify-between cursor-default">
                  <span className="text-slate-500 cursor-default">Parcelas / Gastos do Mês:</span>
                  <span className="font-medium cursor-default">{formatBRL(totalMonthlyInstallments)}</span>
                </div>
                <div className="flex justify-between cursor-default">
                  <span className="text-slate-500 cursor-default">Total Acumulado de Compras:</span>
                  <span className="font-medium cursor-default">{formatBRL(totalExpenses)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-base font-bold cursor-default">
                  <span className="cursor-default">Total Mensal Comprometido:</span>
                  <span className="text-rose-500 cursor-default">{formatBRL(totalSpentMonth)}</span>
                </div>
              </div>
            </section>
          </div>

          {/* COLUNA DIREITA */}
          <div className="lg:col-span-8 space-y-6">
            {/* CARTÕES DE CRÉDITO */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4 text-purple-500 cursor-default">
                <CreditCard size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Cartões de Crédito e Limites</h2>
              </div>

              <form onSubmit={handleAddCard} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Nome do Cartão (ex: Nubank)"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <input
                  type="text"
                  placeholder="Limite Total"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(maskCurrencyInput(e.target.value))}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={16} /> Adicionar Cartão
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cards.length === 0 ? (
                  <p className="text-xs text-slate-500 col-span-2 py-2 cursor-default">Nenhum cartão cadastrado.</p>
                ) : (
                  cards.map((card) => {
                    const used = expenses
                      .filter((e) => e.paymentSource === card.id)
                      .reduce((acc, e) => acc + (Number(e.totalAmount) || 0), 0);
                    const available = (Number(card.limit) || 0) - used;

                    return (
                      <div key={card.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                        {editingCardId === card.id ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] text-slate-400 cursor-default">Nome do Cartão</label>
                              <input
                                type="text"
                                value={editCardName}
                                onChange={(e) => setEditCardName(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 cursor-default">Limite Total (R$)</label>
                              <input
                                type="text"
                                value={editCardLimit}
                                onChange={(e) => setEditCardLimit(maskCurrencyInput(e.target.value))}
                                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => handleSaveCardEdit(card.id)}
                                className="px-3 py-1 rounded bg-emerald-600 text-white text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Check size={14} /> Salvar
                              </button>
                              <button
                                onClick={() => setEditingCardId(null)}
                                className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <X size={14} /> Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold cursor-default">{card.name}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => startEditCard(card)}
                                  className="text-slate-400 hover:text-purple-500 cursor-pointer"
                                  title="Editar cartão"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleRemoveCard(card.id)}
                                  className="text-slate-400 hover:text-red-500 cursor-pointer"
                                  title="Excluir cartão"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                            <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400 cursor-default">
                              <div className="flex justify-between cursor-default">
                                <span className="cursor-default">Limite Total:</span>
                                <span className="font-medium text-slate-900 dark:text-white cursor-default">{formatBRL(card.limit)}</span>
                              </div>
                              <div className="flex justify-between cursor-default">
                                <span className="cursor-default">Utilizado:</span>
                                <span className="font-medium text-rose-500 cursor-default">{formatBRL(used)}</span>
                              </div>
                              <div className="flex justify-between cursor-default">
                                <span className="cursor-default">Disponível:</span>
                                <span className="font-medium text-emerald-500 cursor-default">{formatBRL(available)}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* REGISTRAR NOVO GASTO REFORMULADO */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4 text-emerald-500 cursor-default">
                <ShoppingBag size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Registrar Novo Gasto</h2>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="O que foi gasto?"
                    value={expWhat}
                    onChange={(e) => setExpWhat(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Onde foi gasto?"
                    value={expWhere}
                    onChange={(e) => setExpWhere(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Valor Total"
                    value={expAmount}
                    onChange={(e) => setExpAmount(maskCurrencyInput(e.target.value))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 cursor-default">Categoria</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm cursor-pointer"
                    >
                      {customCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="nova">+ Criar nova categoria...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1 cursor-default">Forma de Pagamento</label>
                    <select
                      value={expPaymentMethod}
                      onChange={(e) => setExpPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm cursor-pointer"
                    >
                      <option value="pix">Pix</option>
                      <option value="debito">Cartão de Débito</option>
                      <option value="credito">Cartão de Crédito</option>
                    </select>
                  </div>
                </div>

                {expCategory === "nova" && (
                  <div>
                    <input
                      type="text"
                      placeholder="Nome da nova categoria"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                    />
                  </div>
                )}

                {/* Condicional para Cartão de Crédito (Parcelas) */}
                {expPaymentMethod === "credito" && (
                  <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1 cursor-default">Selecione o Cartão</label>
                      <select
                        value={expCreditCardId}
                        onChange={(e) => setExpCreditCardId(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm cursor-pointer"
                      >
                        <option value="">-- Escolha o Cartão --</option>
                        {cards.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} (Limite: {formatBRL(c.limit)})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1 cursor-default">Parcelas</label>
                      <select
                        value={expInstallments}
                        onChange={(e) => setExpInstallments(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}x {n > 1 ? `de ${formatBRL(parseMaskedCurrency(expAmount) / n)}` : "(À vista)"}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Plus size={16} /> Lançar Gasto
                </button>
              </form>
            </section>

            {/* HISTÓRICO DE GASTOS */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4 text-amber-500 cursor-default">
                <Layers size={20} />
                <h2 className="font-bold text-slate-900 dark:text-white cursor-default">Histórico de Gastos, Total e Parcelas</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 cursor-default">O que foi gasto</th>
                      <th className="py-2 cursor-default">Onde</th>
                      <th className="py-2 cursor-default">Categoria</th>
                      <th className="py-2 cursor-default">Pagamento</th>
                      <th className="py-2 cursor-default">Parcelas</th>
                      <th className="py-2 cursor-default">Total</th>
                      <th className="py-2 text-right cursor-default">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-xs text-slate-500 cursor-default">
                          Nenhum gasto registrado até o momento.
                        </td>
                      </tr>
                    ) : (
                      expenses.map((exp) => (
                        <tr key={exp.id}>
                          {editingExpId === exp.id ? (
                            <>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={editExpWhat}
                                  onChange={(e) => setEditExpWhat(e.target.value)}
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={editExpWhere}
                                  onChange={(e) => setEditExpWhere(e.target.value)}
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <select
                                  value={editExpCategory}
                                  onChange={(e) => setEditExpCategory(e.target.value)}
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs cursor-pointer"
                                >
                                  {customCategories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 pr-2">
                                <select
                                  value={editExpPaymentMethod}
                                  onChange={(e) => setEditExpPaymentMethod(e.target.value)}
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs cursor-pointer"
                                >
                                  <option value="pix">Pix</option>
                                  <option value="debito">Débito</option>
                                  <option value="credito">Crédito</option>
                                </select>
                              </td>
                              <td className="py-2 pr-2">
                                {editExpPaymentMethod === "credito" ? (
                                  <input
                                    type="number"
                                    min="1"
                                    max="24"
                                    value={editExpInstallments}
                                    onChange={(e) => setEditExpInstallments(Number(e.target.value))}
                                    className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-400">1x</span>
                                )}
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={editExpAmount}
                                  onChange={(e) => setEditExpAmount(maskCurrencyInput(e.target.value))}
                                  className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                              </td>
                              <td className="py-2 text-right space-x-2">
                                <button onClick={() => handleSaveExpenseEdit(exp.id)} className="text-emerald-500 cursor-pointer" title="Salvar">
                                  <Check size={16} />
                                </button>
                                <button onClick={() => setEditingExpId(null)} className="text-slate-400 cursor-pointer" title="Cancelar">
                                  <X size={16} />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 font-medium cursor-default">{exp.what}</td>
                              <td className="py-3 text-slate-500 cursor-default">{exp.where}</td>
                              <td className="py-3 cursor-default">
                                <span className="px-2 py-0.5 rounded text-xs bg-slate-200 dark:bg-slate-800 cursor-default">
                                  {exp.category || "Geral"}
                                </span>
                              </td>
                              <td className="py-3 cursor-default">{exp.paymentLabel}</td>
                              <td className="py-3 cursor-default">
                                {Number(exp.installments) > 1 ? (
                                  <>
                                    {exp.installments}x de{" "}
                                    <span className="font-medium cursor-default">
                                      {formatBRL(exp.installmentValue)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="cursor-default">À vista</span>
                                )}
                              </td>
                              <td className="py-3 font-bold cursor-default">{formatBRL(exp.totalAmount)}</td>
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
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
