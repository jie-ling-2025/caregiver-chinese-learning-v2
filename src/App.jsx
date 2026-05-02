import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Heart,
  Languages,
  Search,
  Star,
  Volume2,
} from 'lucide-react';
import phrases from './data/phrases.json';

const FAVORITES_KEY = 'caregiver-chinese-learning:favorites';

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

function findVoice(voices, lang) {
  const normalizedLang = lang.toLowerCase();
  const languagePrefix = normalizedLang.split('-')[0];

  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalizedLang) ??
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(`${languagePrefix}-`),
    ) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix))
  );
}

async function speak(text, lang) {
  if (!('speechSynthesis' in window)) {
    alert('這個瀏覽器目前不支援語音播放。');
    return;
  }

  const voices = await getVoices();
  const voice = findVoice(voices, lang);

  if (!voice) {
    const languageName = lang === 'vi-VN' ? '越南語' : '中文';
    alert(
      `目前瀏覽器或系統沒有可用的${languageName}語音，所以先不播放錯誤發音。建議之後改接真人錄音檔，或在系統/瀏覽器安裝${languageName}語音。`,
    );
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.voice = voice;
  utterance.rate = lang === 'zh-TW' ? 0.82 : 0.9;
  window.speechSynthesis.speak(utterance);
}

function playAudio(audioPath) {
  if (!audioPath) {
    alert('此句尚未加入越南語音檔');
    return;
  }

  window.speechSynthesis?.cancel();

  const audioUrl = `${import.meta.env.BASE_URL}${audioPath.replace(/^\//, '')}`;
  const audio = new Audio(audioUrl);

  audio.addEventListener('error', () => {
    alert('此句尚未加入越南語音檔');
  });

  audio.play().catch(() => {
    alert('此句尚未加入越南語音檔');
  });
}

function App() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY)) ?? [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const categories = useMemo(() => {
    return ['全部', ...new Set(phrases.map((phrase) => phrase.category))];
  }, []);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const filteredPhrases = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return phrases.filter((phrase) => {
      const matchesCategory =
        selectedCategory === '全部' || phrase.category === selectedCategory;
      const matchesFavorite = !showFavoritesOnly || favoriteSet.has(phrase.id);
      const matchesKeyword =
        keyword.length === 0 ||
        phrase.chinese.toLowerCase().includes(keyword) ||
        phrase.vietnamese.toLowerCase().includes(keyword) ||
        phrase.pinyin.toLowerCase().includes(keyword) ||
        phrase.category.toLowerCase().includes(keyword);

      return matchesCategory && matchesFavorite && matchesKeyword;
    });
  }, [favoriteSet, query, selectedCategory, showFavoritesOnly]);

  function toggleFavorite(id) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id],
    );
  }

  return (
    <main>
      <section className="hero">
        <div className="hero__badge">
          <Languages size={18} />
          長照機構常用中文
        </div>
        <h1>外籍照服員中文學習</h1>
        <p>
          用手機就能練習照護現場常見句子，快速查看中文、越南語、拼音，也可以收藏每天要複習的句子。
        </p>
      </section>

      <section className="toolbar" aria-label="搜尋與篩選">
        <label className="searchBox">
          <Search size={18} />
          <input
            type="search"
            placeholder="搜尋中文、越南語、拼音或分類"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="categoryScroller" aria-label="分類篩選">
          {categories.map((category) => (
            <button
              className={category === selectedCategory ? 'chip isActive' : 'chip'}
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <button
          className={showFavoritesOnly ? 'favoriteFilter isActive' : 'favoriteFilter'}
          type="button"
          onClick={() => setShowFavoritesOnly((value) => !value)}
        >
          <Star size={18} />
          只看收藏
          <span>{favorites.length}</span>
        </button>
      </section>

      <section className="summary" aria-live="polite">
        <BookOpen size={18} />
        顯示 {filteredPhrases.length} / {phrases.length} 句
      </section>

      <section className="phraseList" aria-label="句子列表">
        {filteredPhrases.map((phrase) => {
          const isFavorite = favoriteSet.has(phrase.id);

          return (
            <article className="phraseCard" key={phrase.id}>
              <div className="phraseCard__top">
                <span>{phrase.category}</span>
                <button
                  className={isFavorite ? 'iconButton isFavorite' : 'iconButton'}
                  type="button"
                  aria-label={isFavorite ? '取消收藏' : '加入收藏'}
                  onClick={() => toggleFavorite(phrase.id)}
                >
                  <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="phraseText">
                <h2>{phrase.chinese}</h2>
                <p className="pinyin">{phrase.pinyin}</p>
                <p className="translation">{phrase.vietnamese}</p>
              </div>

              <div className="actions">
                <button type="button" onClick={() => speak(phrase.chinese, 'zh-TW')}>
                  <Volume2 size={18} />
                  中文
                </button>
                <button
                  type="button"
                  onClick={() => playAudio(phrase.viAudio)}
                >
                  <Volume2 size={18} />
                  Tiếng Việt
                </button>
              </div>
            </article>
          );
        })}

        {filteredPhrases.length === 0 && (
          <div className="emptyState">
            <Search size={24} />
            <p>找不到符合條件的句子，請換個關鍵字或分類。</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
