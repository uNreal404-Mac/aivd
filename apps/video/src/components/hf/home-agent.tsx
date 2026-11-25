'use client';

import Link from 'next/link';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FolderOpen,
  LayoutGrid,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CreativeAgentComposer } from '@/components/creative-space/creative-agent-composer';
import {
  CREATIVE_SKILL_CATEGORIES,
  skillsFor,
  type CreativeSkill,
  type CreativeSkillCategory,
} from '@/lib/creative-skills';
import { localizedHref } from '@/lib/du-home';
import { HomeComposerResize } from './home-composer-resize';
import '@/components/creative-space/creative-space-home.css';
import './home-agent.css';

type Panel = 'model' | 'skills' | 'mode';

export function HomeAgent({
  lang,
  active,
  onResize,
}: { lang: string; active: boolean; onResize: (size: { width: number; height: number }) => void }) {
  const zh = lang.toLowerCase().startsWith('zh');
  const language = zh ? 'zh' : 'en';
  const [brief, setBrief] = useState('');
  const [skill, setSkill] = useState<CreativeSkill | null>(null);
  const [category, setCategory] = useState<CreativeSkillCategory>('story');
  const [details, setDetails] = useState<CreativeSkill | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const root = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = detailDialog.current;
    if (!dialog || !active || !details) return;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [active, details]);
  const closeDetails = () => {
    const former = details;
    setDetails(null);
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-skill-details="${former?.id}"]`)
        ?.focus({ preventScroll: true })
    );
  };

  useEffect(() => {
    if (!active) {
      setPanel(null);
      setDetails(null);
    }
    if (!active || !panel) return;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('[data-agent-menu], [data-agent-trigger]')) setPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || detailDialog.current?.open) return;
      setPanel(null);
      requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [active, panel]);

  const open = (value: Panel, trigger: HTMLButtonElement, nextCategory?: CreativeSkillCategory) => {
    if (value === panel && !nextCategory) {
      setPanel(null);
      return;
    }
    opener.current = trigger;
    setDetails(null);
    if (nextCategory) setCategory(nextCategory);
    setPanel(value);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('.ha-menu')?.focus({ preventScroll: true }));
  };
  const apply = (item: CreativeSkill) => {
    setSkill(item);
    setCategory(item.category);
    setDetails(null);
    setPanel(null);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };
  const trigger = (value: Panel, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      data-agent-trigger
      className={`ha-trigger ha-trigger-${value}`}
      aria-expanded={panel === value}
      aria-haspopup="dialog"
      onClick={(event) => open(value, event.currentTarget)}
    >
      {icon}
      {label}
      {value === 'skills' ? <ChevronDown size={12} /> : null}
    </button>
  );
  const skillsTitle = zh ? '技能' : 'Skills';
  const modeTitle = zh ? '生成模式' : 'Generation mode';
  const modelTitle = zh ? '模型' : 'Model';
  const mode = zh ? '引导规划' : 'Guided plan';
  const controls = (
    <>
      {trigger('model', 'DeepSeek', <Sparkles size={14} />)}
      {skill ? (
        <span className="ha-selected-skill">
          {trigger('skills', skill.title[language], null)}
          <button
            type="button"
            aria-label={zh ? `移除技能 ${skill.title.zh}` : `Remove skill ${skill.title.en}`}
            onClick={() => setSkill(null)}
          >
            <X size={12} />
          </button>
        </span>
      ) : (
        trigger('skills', skillsTitle, <BookOpen size={14} />)
      )}
      {trigger('mode', mode, <ChevronDown size={12} />)}
      {panel ? (
        <dialog
          open
          tabIndex={-1}
          data-agent-menu
          className={`ha-menu ha-menu-${panel}`}
          aria-label={panel === 'skills' ? skillsTitle : panel === 'model' ? modelTitle : modeTitle}
        >
          {panel === 'skills' ? (
            <>
              <header className="ha-heading">
                <strong>{skillsTitle}</strong>
                <Link href={`${localizedHref(lang, '/creative-space')}#cs-cat-${category}`}>
                  {zh ? '更多' : 'More'}
                  <ChevronRight size={12} />
                </Link>
              </header>
              <nav className="ha-tabs" aria-label={zh ? '技能分类' : 'Skill categories'}>
                {CREATIVE_SKILL_CATEGORIES.map((item) => (
                  <button
                    type="button"
                    aria-pressed={category === item.id}
                    key={item.id}
                    onClick={() => setCategory(item.id)}
                  >
                    {item[language]}
                  </button>
                ))}
              </nav>
              <div className="ha-list">
                {skillsFor(category).map((item) => (
                  <div className="ha-row" key={item.id}>
                    <button type="button" className="ha-apply" onClick={() => apply(item)}>
                      <img alt="" src={item.image} />
                      <span>
                        <strong>{item.title[language]}</strong>
                        <small>{item.description[language]}</small>
                      </span>
                      {skill?.id === item.id ? <Check size={15} /> : null}
                    </button>
                    <button
                      type="button"
                      className="ha-info"
                      aria-label={zh ? `查看${item.title.zh}技能详情` : `View ${item.title.en} skill details`}
                      data-skill-details={item.id}
                      onClick={() => setDetails(item)}
                    >
                      <CircleHelp size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <header className="ha-heading">
                <strong>{panel === 'model' ? modelTitle : modeTitle}</strong>
              </header>
              <div className="ha-info-row">
                <span>{panel === 'model' ? <Sparkles size={18} /> : <LayoutGrid size={18} />}</span>
                <div>
                  <strong>{panel === 'model' ? 'DeepSeek' : mode}</strong>
                  <p>
                    {panel === 'model'
                      ? zh
                        ? '根据创作描述和参考图编写分镜与生成提示词。'
                        : 'Plans a storyboard and writes a generation prompt from your brief and reference images.'
                      : zh
                        ? '先生成免费创作计划，审阅后在画布中继续。'
                        : 'Review your free creative plan, then continue on the canvas.'}
                  </p>
                </div>
                <Check size={15} />
              </div>
            </>
          )}
        </dialog>
      ) : null}
    </>
  );
  return (
    <section ref={root} className="du-home-agent" hidden={!active} role="tabpanel" aria-label="Agent">
      <CreativeAgentComposer
        lang={lang}
        brief={brief}
        onBriefChange={setBrief}
        inputRef={inputRef}
        active={active}
        home={{ controls, skill, resizeGrip: <HomeComposerResize zh={zh} onResize={onResize} /> }}
      />
      <Link className="ha-workspace" href={localizedHref(lang, '/creative-space')}>
        <FolderOpen size={13} />
        {zh ? '创作空间' : 'Creative space'}
        <ChevronRight size={11} />
      </Link>
      <nav className="ha-shortcuts" aria-label={zh ? '常用技能' : 'Popular skills'}>
        {skill ? (
          <>
            <button type="button" onClick={() => setSkill(null)}>
              {CREATIVE_SKILL_CATEGORIES.find((item) => item.id === skill.category)?.[language]}
              <X size={11} />
            </button>
            {skillsFor(skill.category).map((item) => (
              <button key={item.id} type="button" aria-pressed={skill.id === item.id} onClick={() => apply(item)}>
                {item.title[language]}
              </button>
            ))}
          </>
        ) : (
          CREATIVE_SKILL_CATEGORIES.map((item) => (
            <button
              key={item.id}
              data-agent-trigger
              type="button"
              onClick={(event) => open('skills', event.currentTarget, item.id)}
            >
              {item[language]}
            </button>
          ))
        )}
      </nav>
      {details ? (
        <dialog
          ref={detailDialog}
          data-agent-menu
          className="ha-detail"
          aria-labelledby="ha-detail-title"
          onCancel={(event) => {
            event.preventDefault();
            closeDetails();
          }}
        >
          <img src={details.image} alt="" />
          <button
            className="ha-detail-close"
            type="button"
            aria-label={zh ? '关闭技能详情' : 'Close skill details'}
            onClick={closeDetails}
          >
            <X size={16} />
          </button>
          <div>
            <small>
              {CREATIVE_SKILL_CATEGORIES.find((item) => item.id === details.category)?.[language]} /{' '}
              {details.title[language]}
            </small>
            <h2 id="ha-detail-title">{details.title[language]}</h2>
            <p>{details.description[language]}</p>
            <button className="ha-detail-use" type="button" onClick={() => apply(details)}>
              {zh ? '使用这个技能' : 'Use this skill'}
            </button>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
