import { ChangeEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

type ActionMode = 'Move Only' | 'Move + Click' | 'Move + Double Click' | 'Move + Right Click';
type CoordMode = 'Window' | 'Client' | 'Screen';

type Scenario = {
  id: string;
  name: string;
  windowTitle: string;
  windowText: string;
  hotkey: string;
  x: number;
  y: number;
  mode: ActionMode;
  note: string;
  imageName?: string;
  imageSrc?: string;
  imageWidth?: number;
  imageHeight?: number;
  step: number;
};

type GlobalSettings = {
  coordMode: CoordMode;
  mouseSpeed: number;
  sleepBefore: number;
  sleepAfterActivate: number;
  sleepAfterMove: number;
  activationTimeout: number;
};

const STORAGE_KEY = 'pointkey-react-v1';
const stepOptions = [1, 5, 10, 20, 50];
const modes: ActionMode[] = ['Move Only', 'Move + Click', 'Move + Double Click', 'Move + Right Click'];
const coordModes: CoordMode[] = ['Window', 'Client', 'Screen'];

function createScenario(index: number): Scenario {
  return {
    id: crypto.randomUUID(),
    name: `시나리오 ${index + 1}`,
    windowTitle: '',
    windowText: '',
    hotkey: `F${index + 1}`,
    x: 0,
    y: 0,
    mode: 'Move + Click',
    note: '',
    step: 10,
  };
}

function defaultState() {
  return {
    scenarios: [createScenario(0), createScenario(1), createScenario(2)],
    settings: {
      coordMode: 'Window' as CoordMode,
      mouseSpeed: 0,
      sleepBefore: 0,
      sleepAfterActivate: 100,
      sleepAfterMove: 0,
      activationTimeout: 2,
    },
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function escapeAhkText(value: string) {
  return value.replace(/"/g, '`"');
}

function makeAhk(scenarios: Scenario[], settings: GlobalSettings) {
  const lines: string[] = [];
  lines.push('#Requires AutoHotkey v2.0');
  lines.push(`CoordMode "Mouse", "${settings.coordMode}"`);
  lines.push('');

  for (const sc of scenarios) {
    const hotkey = sc.hotkey.trim();
    if (!hotkey) continue;

    lines.push(`${hotkey}::{`);

    if (sc.note.trim()) {
      for (const line of sc.note.split('\n')) lines.push(`    ; ${line}`);
    }

    if (settings.sleepBefore > 0) lines.push(`    Sleep ${settings.sleepBefore}`);

    if (sc.windowTitle.trim()) {
      const title = escapeAhkText(sc.windowTitle.trim());
      const text = escapeAhkText(sc.windowText.trim());
      if (text) {
        lines.push(`    hwnd := WinExist("${title}", "${text}")`);
      } else {
        lines.push(`    hwnd := WinExist("${title}")`);
      }
      lines.push('    if !hwnd {');
      lines.push('        MsgBox "대상 창을 찾지 못했습니다."');
      lines.push('        return');
      lines.push('    }');
      if (text) {
        lines.push(`    WinActivate "${title}", "${text}"`);
      } else {
        lines.push(`    WinActivate "${title}"`);
      }
      lines.push(`    WinWaitActive hwnd,, ${Math.max(100, Math.round(settings.activationTimeout * 1000))}`);
      if (settings.sleepAfterActivate > 0) lines.push(`    Sleep ${settings.sleepAfterActivate}`);
    }

    lines.push(`    MouseMove ${Math.round(sc.x)}, ${Math.round(sc.y)}, ${settings.mouseSpeed}`);
    if (settings.sleepAfterMove > 0) lines.push(`    Sleep ${settings.sleepAfterMove}`);
    if (sc.mode === 'Move + Click') lines.push('    Click');
    if (sc.mode === 'Move + Double Click') lines.push('    Click 2');
    if (sc.mode === 'Move + Right Click') lines.push('    Click "right"');
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState().scenarios;
    try {
      const parsed = JSON.parse(saved);
      return parsed.scenarios?.length ? parsed.scenarios : defaultState().scenarios;
    } catch {
      return defaultState().scenarios;
    }
  });

  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState().settings;
    try {
      const parsed = JSON.parse(saved);
      return parsed.settings ?? defaultState().settings;
    } catch {
      return defaultState().settings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scenarios, settings }));
  }, [scenarios, settings]);

  const code = useMemo(() => makeAhk(scenarios, settings), [scenarios, settings]);

  const updateScenario = (id: string, patch: Partial<Scenario>) => {
    setScenarios((prev) => prev.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)));
  };

  const nudgeScenario = (id: string, dx: number, dy: number) => {
    setScenarios((prev) =>
      prev.map((sc) => {
        if (sc.id !== id) return sc;
        const maxX = typeof sc.imageWidth === 'number' ? sc.imageWidth - 1 : Number.MAX_SAFE_INTEGER;
        const maxY = typeof sc.imageHeight === 'number' ? sc.imageHeight - 1 : Number.MAX_SAFE_INTEGER;
        return {
          ...sc,
          x: clamp(sc.x + dx * sc.step, 0, maxX),
          y: clamp(sc.y + dy * sc.step, 0, maxY),
        };
      })
    );
  };

  const resetScenario = (id: string) => updateScenario(id, { x: 0, y: 0 });

  const addScenario = () => setScenarios((prev) => [...prev, createScenario(prev.length)]);
  const removeScenario = (id: string) => setScenarios((prev) => prev.filter((sc) => sc.id !== id));

  const onImageUpload = (id: string, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setScenarios((prev) =>
          prev.map((sc) =>
            sc.id === id
              ? {
                  ...sc,
                  imageName: file.name,
                  imageSrc: String(reader.result),
                  imageWidth: img.naturalWidth,
                  imageHeight: img.naturalHeight,
                  x: clamp(sc.x, 0, img.naturalWidth - 1),
                  y: clamp(sc.y, 0, img.naturalHeight - 1),
                }
              : sc
          )
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const downloadAhk = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pointkey_generated.ahk';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    const fresh = defaultState();
    setScenarios(fresh.scenarios);
    setSettings(fresh.settings);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar card">
        <h1>PointKey React MVP</h1>
        <p className="muted">시나리오별 캡처 이미지, 포인트 지정, 조이스틱 이동, AHK v2 코드 생성기</p>

        <div className="section">
          <h2>전역 설정</h2>
          <label>
            좌표 기준
            <select value={settings.coordMode} onChange={(e) => setSettings({ ...settings, coordMode: e.target.value as CoordMode })}>
              {coordModes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            마우스 이동 속도
            <input type="range" min={0} max={100} value={settings.mouseSpeed} onChange={(e) => setSettings({ ...settings, mouseSpeed: Number(e.target.value) })} />
            <span className="inline-value">{settings.mouseSpeed}</span>
          </label>
          <label>
            실행 전 대기(ms)
            <input type="number" min={0} value={settings.sleepBefore} onChange={(e) => setSettings({ ...settings, sleepBefore: Number(e.target.value) || 0 })} />
          </label>
          <label>
            창 활성화 후 대기(ms)
            <input type="number" min={0} value={settings.sleepAfterActivate} onChange={(e) => setSettings({ ...settings, sleepAfterActivate: Number(e.target.value) || 0 })} />
          </label>
          <label>
            마우스 이동 후 대기(ms)
            <input type="number" min={0} value={settings.sleepAfterMove} onChange={(e) => setSettings({ ...settings, sleepAfterMove: Number(e.target.value) || 0 })} />
          </label>
          <label>
            창 활성화 타임아웃(초)
            <input type="number" min={0.1} step={0.1} value={settings.activationTimeout} onChange={(e) => setSettings({ ...settings, activationTimeout: Number(e.target.value) || 0.1 })} />
          </label>
        </div>

        <div className="section button-stack">
          <button onClick={addScenario}>+ 시나리오 추가</button>
          <button onClick={downloadAhk}>.ahk 다운로드</button>
          <button className="danger" onClick={resetAll}>전체 초기화</button>
        </div>
      </aside>

      <main className="main-panel">
        <section className="card code-card">
          <div className="code-header">
            <h2>생성된 AutoHotkey v2 코드</h2>
            <button onClick={() => navigator.clipboard.writeText(code)}>복사</button>
          </div>
          <pre>{code}</pre>
        </section>

        {scenarios.map((scenario, index) => (
          <ScenarioEditor
            key={scenario.id}
            index={index}
            scenario={scenario}
            canRemove={scenarios.length > 1}
            onUpdate={updateScenario}
            onNudge={nudgeScenario}
            onReset={resetScenario}
            onRemove={removeScenario}
            onImageUpload={onImageUpload}
          />
        ))}
      </main>
    </div>
  );
}

type ScenarioEditorProps = {
  index: number;
  scenario: Scenario;
  canRemove: boolean;
  onUpdate: (id: string, patch: Partial<Scenario>) => void;
  onNudge: (id: string, dx: number, dy: number) => void;
  onReset: (id: string) => void;
  onRemove: (id: string) => void;
  onImageUpload: (id: string, file?: File) => void;
};

function ScenarioEditor({ index, scenario, canRemove, onUpdate, onNudge, onReset, onRemove, onImageUpload }: ScenarioEditorProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleImageClick = (e: MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current || !scenario.imageWidth || !scenario.imageHeight) return;
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = scenario.imageWidth / rect.width;
    const scaleY = scenario.imageHeight / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    onUpdate(scenario.id, {
      x: clamp(x, 0, scenario.imageWidth - 1),
      y: clamp(y, 0, scenario.imageHeight - 1),
    });
  };

  const xPercent = scenario.imageWidth ? (scenario.x / scenario.imageWidth) * 100 : 0;
  const yPercent = scenario.imageHeight ? (scenario.y / scenario.imageHeight) * 100 : 0;

  return (
    <section className="card scenario-card">
      <div className="scenario-header">
        <h2>{scenario.name}</h2>
        {canRemove && <button className="danger ghost" onClick={() => onRemove(scenario.id)}>삭제</button>}
      </div>

      <div className="scenario-grid">
        <div className="preview-panel">
          <label className="upload-box">
            <span>참고용 화면 캡처 업로드</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e: ChangeEvent<HTMLInputElement>) => onImageUpload(scenario.id, e.target.files?.[0])}
            />
          </label>

          {scenario.imageSrc ? (
            <div className="image-frame">
              <img ref={imgRef} src={scenario.imageSrc} alt={scenario.imageName || scenario.name} onClick={handleImageClick} />
              <div className="crosshair" style={{ left: `${xPercent}%`, top: `${yPercent}%` }}>
                <div className="cross-h" />
                <div className="cross-v" />
                <div className="cross-dot" />
              </div>
            </div>
          ) : (
            <div className="empty-preview">이미지를 올리면 클릭으로 포인트를 지정할 수 있어.</div>
          )}

          <div className="meta-line">
            <span>{scenario.imageName || '이미지 없음'}</span>
            <span>{scenario.imageWidth && scenario.imageHeight ? `${scenario.imageWidth} × ${scenario.imageHeight}` : ''}</span>
            <span>포인트: ({scenario.x}, {scenario.y})</span>
          </div>
        </div>

        <div className="editor-panel">
          <div className="form-grid">
            <label>
              시나리오 이름
              <input value={scenario.name} onChange={(e) => onUpdate(scenario.id, { name: e.target.value })} />
            </label>
            <label>
              단축키
              <input value={scenario.hotkey} onChange={(e) => onUpdate(scenario.id, { hotkey: e.target.value })} />
            </label>
            <label>
              대상 창 제목 (WinTitle)
              <input value={scenario.windowTitle} onChange={(e) => onUpdate(scenario.id, { windowTitle: e.target.value })} />
            </label>
            <label>
              창 내부 텍스트 (선택)
              <input value={scenario.windowText} onChange={(e) => onUpdate(scenario.id, { windowText: e.target.value })} />
            </label>
            <label>
              동작
              <select value={scenario.mode} onChange={(e) => onUpdate(scenario.id, { mode: e.target.value as ActionMode })}>
                {modes.map((mode) => <option key={mode}>{mode}</option>)}
              </select>
            </label>
            <label>
              이동 단위(px)
              <select value={scenario.step} onChange={(e) => onUpdate(scenario.id, { step: Number(e.target.value) })}>
                {stepOptions.map((step) => <option key={step} value={step}>{step}</option>)}
              </select>
            </label>
          </div>

          <label>
            메모
            <textarea rows={4} value={scenario.note} onChange={(e) => onUpdate(scenario.id, { note: e.target.value })} />
          </label>

          <div className="coord-row">
            <label>
              X 좌표
              <input
                type="number"
                min={0}
                max={scenario.imageWidth ? scenario.imageWidth - 1 : 100000}
                value={scenario.x}
                onChange={(e) => onUpdate(scenario.id, { x: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
            <label>
              Y 좌표
              <input
                type="number"
                min={0}
                max={scenario.imageHeight ? scenario.imageHeight - 1 : 100000}
                value={scenario.y}
                onChange={(e) => onUpdate(scenario.id, { y: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
          </div>

          <div className="joystick-wrap">
            <div className="joystick-title">조이스틱 포인터</div>
            <div className="joystick-grid">
              <button onClick={() => onNudge(scenario.id, -1, -1)}>↖</button>
              <button onClick={() => onNudge(scenario.id, 0, -1)}>↑</button>
              <button onClick={() => onNudge(scenario.id, 1, -1)}>↗</button>
              <button onClick={() => onNudge(scenario.id, -1, 0)}>←</button>
              <button className="reset" onClick={() => onReset(scenario.id)}>● Reset</button>
              <button onClick={() => onNudge(scenario.id, 1, 0)}>→</button>
              <button onClick={() => onNudge(scenario.id, -1, 1)}>↙</button>
              <button onClick={() => onNudge(scenario.id, 0, 1)}>↓</button>
              <button onClick={() => onNudge(scenario.id, 1, 1)}>↘</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default App;
