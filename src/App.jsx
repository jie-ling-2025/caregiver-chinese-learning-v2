import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Cloud,
  FolderPlus,
  ListFilter,
  Menu,
  Plus,
  RefreshCw,
  X,
  Volume2,
} from 'lucide-react';
import fallbackPhrases from './data/phrases.json';

const GAS_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzCrERurUtlAyvl8nxCTVn0gUthzsAUCBKHGnK08EibkW3w656EKX6qtpxZyG1TtBE4/exec';

const PENDING_SUBMISSIONS_KEY =
  'caregiver-chinese-learning-v2-pending-submissions';

function normalizePhrase(phrase, source) {
  const category = String(phrase.category ?? '').trim();

  return {
    id: String(phrase.id ?? `${source}-${Date.now()}`),
    category: category || '其他',
    vietnamese: String(phrase.vietnamese ?? '').trim(),
    chinese: String(phrase.chinese ?? '').trim(),
    submitter: String(phrase.submitter ?? '').trim(),
    updatedAt: String(phrase.updated_at ?? phrase.updatedAt ?? '').trim(),
    source,
  };
}

function isApproved(phrase) {
  if (phrase.approved === true) {
    return true;
  }

  return String(phrase.approved ?? '').trim().toUpperCase() === 'TRUE';
}

function formatLastUpdated(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const formatter = new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(date).replace(/\//g, '/');
}

function getPhraseKey(phrase) {
  return [
    phrase.category,
    phrase.vietnamese,
    phrase.chinese,
  ]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .join('|');
}

function getComparableTextKey(phrase) {
  return [
    phrase.category,
    phrase.vietnamese,
    phrase.chinese,
  ]
    .map((value) =>
      String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[。！？!?.,，\s]/g, ''),
    )
    .join('|');
}

function loadPendingSubmissions() {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_SUBMISSIONS_KEY));
    return Array.isArray(saved) ? saved.map((item) => normalizePhrase(item, 'pending')) : [];
  } catch {
    return [];
  }
}

function getVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function findChineseVoice(voices) {
  return (
    voices.find((voice) => voice.lang.toLowerCase() === 'zh-tw') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('zh-')) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('zh'))
  );
}

async function speakChinese(chinese) {
  if (!chinese.trim()) {
    return;
  }

  if (!('speechSynthesis' in window)) {
    alert('這個瀏覽器目前不支援中文語音播放。');
    return;
  }

  const voices = await getVoices();
  const voice = findChineseVoice(voices);

  if (!voice) {
    alert('目前瀏覽器或系統沒有可用的中文語音，請安裝或啟用 zh-TW 中文語音。');
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(chinese);
  utterance.lang = 'zh-TW';
  utterance.voice = voice;
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function App() {
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [officialPhrases, setOfficialPhrases] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState(loadPendingSubmissions);
  const [customCategories, setCustomCategories] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [loadMessage, setLoadMessage] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [submitState, setSubmitState] = useState('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState({
    category: '',
    vietnamese: '',
    chinese: '',
    submitter: '',
    passphrase: '',
  });

  useEffect(() => {
    let ignore = false;

    async function loadCloudPhrases() {
      setLoadState('loading');
      setLoadMessage('');

      try {
        const url = `${GAS_ENDPOINT}?cacheBust=${Date.now()}`;
        const response = await fetch(url, {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Cloud response was not ok.');
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error(result.message || 'Cloud data format is invalid.');
        }

        if (ignore) {
          return;
        }

        const cloudPhrases = result.data
          .filter(isApproved)
          .map((phrase) => normalizePhrase(phrase, 'cloud'))
          .filter((phrase) => phrase.vietnamese && phrase.chinese);

        setOfficialPhrases(cloudPhrases);
        setLastUpdated(formatLastUpdated(result.lastUpdated));
        setLoadState('cloud');
      } catch {
        if (ignore) {
          return;
        }

        setOfficialPhrases(
          fallbackPhrases
            .map((phrase) => normalizePhrase(phrase, 'fallback'))
            .filter((phrase) => phrase.vietnamese && phrase.chinese),
        );
        setLastUpdated('');
        setLoadState('fallback');
        setLoadMessage('目前無法載入雲端教材，請稍後再試。');
      }
    }

    loadCloudPhrases();

    return () => {
      ignore = true;
    };
  }, [refreshCount]);

  useEffect(() => {
    localStorage.setItem(PENDING_SUBMISSIONS_KEY, JSON.stringify(pendingSubmissions));
  }, [pendingSubmissions]);

  const visiblePendingSubmissions = useMemo(() => {
    const officialIds = new Set(officialPhrases.map((phrase) => phrase.id));
    const officialKeys = new Set(officialPhrases.map(getPhraseKey));
    const officialTextKeys = new Set(officialPhrases.map(getComparableTextKey));

    return pendingSubmissions.filter(
      (phrase) =>
        !officialIds.has(phrase.id) &&
        !officialKeys.has(getPhraseKey(phrase)) &&
        !officialTextKeys.has(getComparableTextKey(phrase)),
    );
  }, [officialPhrases, pendingSubmissions]);

  const allPhrases = useMemo(() => {
    return [...officialPhrases, ...visiblePendingSubmissions];
  }, [officialPhrases, visiblePendingSubmissions]);

  const categories = useMemo(() => {
    const phraseCategories = allPhrases.map((phrase) => phrase.category);
    return Array.from(new Set(phraseCategories))
      .map((category) => category.trim())
      .filter(Boolean);
  }, [allPhrases]);

  const formCategoryOptions = useMemo(() => {
    return Array.from(new Set([...categories, ...customCategories, formData.category]))
      .map((category) => category.trim())
      .filter(Boolean);
  }, [categories, customCategories, formData.category]);

  useEffect(() => {
    if (selectedCategory !== '全部' && !categories.includes(selectedCategory)) {
      setSelectedCategory('全部');
    }
  }, [categories, selectedCategory]);

  const filteredPhrases = useMemo(() => {
    if (selectedCategory === '全部') {
      return allPhrases;
    }

    return allPhrases.filter((phrase) => phrase.category === selectedCategory);
  }, [allPhrases, selectedCategory]);

  const sourceLabel =
    loadState === 'cloud'
      ? '資料來源：雲端正式教材'
      : '資料來源：本機備援教材';

  function updateFormField(field, value) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveCustomCategory(categoryName) {
    const category = categoryName.trim();

    if (!category) {
      return;
    }

    setCustomCategories((current) => {
      if (current.includes(category) || formCategoryOptions.includes(category)) {
        return current;
      }

      return [...current, category];
    });
    setFormData((current) => ({
      ...current,
      category,
    }));
    setNewCategoryName('');
  }

  function openAddModal(category = formData.category) {
    const nextCategory =
      category === '全部' ? formData.category || categories[0] || '' : category;

    setFormData((current) => ({
      ...current,
      category: nextCategory,
    }));
    setSubmitState('idle');
    setSubmitMessage('');
    setIsAddModalOpen(true);
  }

  async function submitPhrase(event) {
    event.preventDefault();

    const payload = {
      category: formData.category,
      vietnamese: formData.vietnamese.trim(),
      chinese: formData.chinese.trim(),
      submitter: formData.submitter.trim(),
      passphrase: formData.passphrase.trim(),
    };

    if (!payload.category || !payload.vietnamese || !payload.chinese || !payload.passphrase) {
      setSubmitMessage('請填寫類別、越南文、中文與通關密語。');
      setSubmitState('error');
      return;
    }

    setSubmitState('submitting');
    setSubmitMessage('正在送出，請稍候。');

    try {
      const response = await fetch(GAS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('投稿送出失敗，請稍後再試。');
      }

      const result = await response.json();

      if (!result.success) {
        setSubmitState('error');
        setSubmitMessage(result.message || '投稿未成功，請確認資料後再試。');
        return;
      }

      const pendingPhrase = normalizePhrase(
        {
          id: result.id || `pending-${Date.now()}`,
          category: payload.category,
          vietnamese: payload.vietnamese,
          chinese: payload.chinese,
          submitter: payload.submitter,
          updatedAt: new Date().toISOString(),
        },
        'pending',
      );

      setPendingSubmissions((current) => [pendingPhrase, ...current]);
      setSelectedCategory('全部');
      setFormData({
        category: payload.category,
        vietnamese: '',
        chinese: '',
        submitter: payload.submitter,
        passphrase: '',
      });
      setSubmitState('success');
      setSubmitMessage(result.message || '已送出，這筆資料會先顯示為待審核測試。');
      setIsAddModalOpen(false);
    } catch (error) {
      setSubmitState('error');
      setSubmitMessage(error.message || '投稿送出失敗，請稍後再試。');
    }
  }

  return (
    <main className="appShell">
      <div className="topActions">
        <button
          className="iconTextButton"
          type="button"
          onClick={() => setIsCategoryOpen((isOpen) => !isOpen)}
          aria-expanded={isCategoryOpen}
          aria-controls="category-drawer"
        >
          <Menu size={22} />
          分類
        </button>
        <button
          className="iconTextButton isPrimary"
          type="button"
          onClick={() => openAddModal(selectedCategory)}
        >
          <Plus size={22} />
          新增單字
        </button>
      </div>

      <section className="hero" aria-labelledby="site-title">
        <div className="eyebrow">越南籍照服員中文學習網站</div>
        <h1 id="site-title">長照現場常用中文</h1>
        <p>
          先看越南文理解情境，再聽中文發音。正式教材由雲端審核資料提供，投稿內容會先留在自己的瀏覽器等待審核。
        </p>
        <div className="lastUpdated">
          <CalendarDays size={18} />
          教材最後更新：{lastUpdated || '尚未提供'}
        </div>
      </section>

      <section className={`notice ${loadState === 'fallback' ? 'isWarning' : ''}`}>
        {loadState === 'loading' ? (
          <>
            <Cloud size={18} />
            正在載入雲端教材...
          </>
        ) : (
          <>
            {loadState === 'fallback' ? <AlertCircle size={18} /> : <Cloud size={18} />}
            <span>
              {sourceLabel}
              {loadMessage ? `。${loadMessage}` : ''}
            </span>
          </>
        )}
        <button
          className="refreshButton"
          type="button"
          onClick={() => setRefreshCount((count) => count + 1)}
          disabled={loadState === 'loading'}
        >
          <RefreshCw size={18} />
          重新載入
        </button>
      </section>

      {isCategoryOpen && (
        <div
          className="sidebarBackdrop"
          role="presentation"
          onClick={() => setIsCategoryOpen(false)}
        >
          <aside
            className="categorySidebar"
            id="category-drawer"
            aria-labelledby="filter-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawerHeader">
              <div className="sectionTitle">
                <ListFilter size={22} />
                <h2 id="filter-title">類別篩選</h2>
              </div>
              <button
                className="closeButton"
                type="button"
                onClick={() => setIsCategoryOpen(false)}
                aria-label="隱藏側邊欄"
              >
                <X size={20} />
              </button>
            </div>

            <div className="categoryList" aria-label="類別篩選">
              {['全部', ...categories].map((category) => (
                <button
                  className={category === selectedCategory ? 'categoryButton isActive' : 'categoryButton'}
                  key={category}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category);
                    setIsCategoryOpen(false);
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      <section className="summary" aria-live="polite">
        <CheckCircle2 size={18} />
        目前顯示 {filteredPhrases.length} 句，正式教材 {officialPhrases.length} 句，待審核測試 {visiblePendingSubmissions.length} 句
      </section>

      {visiblePendingSubmissions.length > 0 && (
        <p className="pendingHint">
          待審核測試只顯示在這個瀏覽器中，不代表正式上架。
        </p>
      )}

      <section className="phraseList" aria-label="教材卡片">
        {filteredPhrases.map((phrase) => (
          <article className="phraseCard" key={`${phrase.source}-${phrase.id}`}>
            <div className="cardHeader">
              <span className="categoryPill">{phrase.category}</span>
              {phrase.source === 'pending' ? (
                <span className="reviewBadge">待審核測試</span>
              ) : (
                <span className="cloudBadge">
                  {phrase.source === 'fallback' ? '本機備援' : '正式教材'}
                </span>
              )}
            </div>

            <div className="phraseBody">
              <p className="vietnamese">{phrase.vietnamese}</p>
              <p className="chinese">{phrase.chinese}</p>
            </div>

            <button
              className="speakButton"
              type="button"
              onClick={() => speakChinese(phrase.chinese)}
            >
              <Volume2 size={22} />
              播放中文
            </button>
          </article>
        ))}
      </section>

      {isAddModalOpen && (
        <div className="modalBackdrop" role="presentation">
          <section
            className="modalPanel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-title"
          >
            <div className="modalHeader">
              <div className="sectionTitle">
                <Plus size={22} />
                <h2 id="add-title">新增單字投稿</h2>
              </div>
              <button
                className="closeButton"
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="關閉新增單字視窗"
              >
                <X size={20} />
              </button>
            </div>

            <form className="addForm" onSubmit={submitPhrase}>
              <label>
                類別
                <select
                  value={formData.category}
                  onChange={(event) => updateFormField('category', event.target.value)}
                >
                  <option value="">請選擇類別</option>
                  {formCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <div className="categoryAddForm addModalCategoryForm">
                <label>
                  找不到類別？新增類別
                  <span className="categoryInputRow">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="例如：復健"
                    />
                    <button
                      type="button"
                      onClick={() => saveCustomCategory(newCategoryName)}
                      aria-label="新增分類"
                    >
                      <FolderPlus size={20} />
                    </button>
                  </span>
                </label>
              </div>

              <label>
                越南文
                <textarea
                  rows="2"
                  value={formData.vietnamese}
                  onChange={(event) => updateFormField('vietnamese', event.target.value)}
                  placeholder="例如：Xin chào."
                />
              </label>

              <label>
                中文
                <textarea
                  rows="2"
                  value={formData.chinese}
                  onChange={(event) => updateFormField('chinese', event.target.value)}
                  placeholder="例如：你好。"
                />
              </label>

              <label>
                投稿者
                <input
                  type="text"
                  value={formData.submitter}
                  onChange={(event) => updateFormField('submitter', event.target.value)}
                  placeholder="例如：Nguyen"
                />
              </label>

              <label>
                通關密語
                <input
                  type="password"
                  value={formData.passphrase}
                  onChange={(event) => updateFormField('passphrase', event.target.value)}
                  placeholder="由管理者提供"
                />
              </label>

              <button
                className="primaryButton"
                type="submit"
                disabled={submitState === 'submitting'}
              >
                <Plus size={20} />
                {submitState === 'submitting' ? '送出中...' : '送出投稿'}
              </button>
            </form>

            {submitMessage && (
              <p className={`formMessage ${submitState === 'error' ? 'isError' : 'isSuccess'}`}>
                {submitMessage}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
