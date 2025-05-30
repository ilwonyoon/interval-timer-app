import { useState, useRef, useEffect } from 'react'
import './App.css'
import startSound from './assets/start.mp3';
import endSound from './assets/end.mp3';

// 기록 타입
interface WorkoutRecord {
  date: string;
  sets: number;
  work: number;
  rest: number;
}

// 세팅 타입
interface WorkoutSetting {
  sets: number;
  work: number;
  rest: number;
}

type Screen = 'home' | 'setup' | 'timer';
type Phase = 'work' | 'rest';

function App() {
  // 화면 상태
  const [screen, setScreen] = useState<Screen>('home');
  // 세팅 입력값
  const [workInput, setWorkInput] = useState(5);
  const [restInput, setRestInput] = useState(5);
  const [setsInput, setSetsInput] = useState(4);

  // 타이머 상태
  const [workDuration, setWorkDuration] = useState(5);
  const [restDuration, setRestDuration] = useState(5);
  const [totalSets, setTotalSets] = useState(4);
  const [phase, setPhase] = useState<Phase>('work');
  const [seconds, setSeconds] = useState(workDuration);
  const [setCount, setSetCount] = useState(1);
  const [isRunning, setIsRunning] = useState(false);

  // 기록
  const [records, setRecords] = useState<WorkoutRecord[]>(() => {
    const saved = localStorage.getItem('workoutRecords');
    return saved ? JSON.parse(saved) : [];
  });

  // 사용한 세팅들 (중복 없이 최신순, 최대 10개)
  const [settings, setSettings] = useState<WorkoutSetting[]>(() => {
    const saved = localStorage.getItem('workoutSettings');
    return saved ? JSON.parse(saved) : [];
  });

  // 최신 상태 추적
  const phaseRef = useRef(phase);
  const setCountRef = useRef(setCount);
  const secondsRef = useRef(seconds);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { setCountRef.current = setCount; }, [setCount]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);

  // 실시간 progress를 위한 상태
  const [progressPercent, setProgressPercent] = useState(1);
  const timerStartRef = useRef<number | null>(null);
  const timerEndRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // 오디오 객체
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const endAudioRef = useRef<HTMLAudioElement | null>(null);

  // 타이머 틱 (1초마다 seconds만 줄임)
  const tick = () => {
    if (secondsRef.current > 1) {
      setSeconds((s) => s - 1);
    } else {
      if (phaseRef.current === 'work') {
        setPhase('rest');
      } else {
        if (setCountRef.current < totalSets) {
          setSetCount((c) => c + 1);
          setPhase('work');
        } else {
          setIsRunning(false);
          // 기록 저장
          const now = new Date();
          const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
          const newRecord: WorkoutRecord = {
            date,
            sets: totalSets,
            work: workDuration,
            rest: restDuration,
          };
          const nextRecords = [newRecord, ...records].slice(0, 20);
          setRecords(nextRecords);
          localStorage.setItem('workoutRecords', JSON.stringify(nextRecords));
          // 세팅 저장 (중복 제거, 최신순)
          const newSetting: WorkoutSetting = { sets: totalSets, work: workDuration, rest: restDuration };
          const filtered = settings.filter(s => !(s.sets === newSetting.sets && s.work === newSetting.work && s.rest === newSetting.rest));
          const nextSettings = [newSetting, ...filtered].slice(0, 10);
          setSettings(nextSettings);
          localStorage.setItem('workoutSettings', JSON.stringify(nextSettings));
          setScreen('home'); // 홈으로 복귀
        }
      }
    }
  };

  // 실시간 progress 애니메이션
  useEffect(() => {
    if (!isRunning) {
      setProgressPercent(1);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    // 타이머 시작/phase 변경 시점에 시작/종료 시각 기록
    const duration = phase === 'work' ? workDuration : restDuration;
    const start = performance.now();
    const end = start + duration * 1000;
    timerStartRef.current = start;
    timerEndRef.current = end;

    function animate(now: number) {
      const total = duration * 1000;
      const remain = Math.max(0, timerEndRef.current! - now);
      setProgressPercent(remain / total);
      if (remain > 0 && isRunning) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setProgressPercent(0);
      }
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, isRunning, workDuration, restDuration, setCount]);

  // 타이머 관리
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // phase가 바뀔 때마다 시간 초기화
  useEffect(() => {
    if (phase === 'work') setSeconds(workDuration);
    else setSeconds(restDuration);
  }, [phase, workDuration, restDuration]);

  // 시간 포맷
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // 타이머 시작/일시정지
  const startTimer = () => setIsRunning(true);
  const pauseTimer = () => setIsRunning(false);

  // 세팅 화면에서 타이머 시작
  const handleStart = async () => {
    setWorkDuration(workInput);
    setRestDuration(restInput);
    setTotalSets(setsInput);
    setPhase('work');
    setSeconds(workInput);
    setSetCount(1);
    setScreen('timer');
    setIsRunning(true);
    if (soundEnabled && startAudioRef.current) {
      startAudioRef.current.currentTime = 0;
      startAudioRef.current.volume = 1;
      try { await startAudioRef.current.play(); } catch (e) {}
    }
  };

  // 세팅 카드 클릭 시 바로 타이머 시작
  const handleSettingQuickStart = (setting: WorkoutSetting) => {
    setWorkDuration(setting.work);
    setRestDuration(setting.rest);
    setTotalSets(setting.sets);
    setPhase('work');
    setSeconds(setting.work);
    setSetCount(1);
    setScreen('timer');
    setIsRunning(true);
  };

  // 홈에서 기록 compact 표시
  const [showAllRecords, setShowAllRecords] = useState(false);
  const renderRecords = () => {
    const visibleRecords = showAllRecords ? records : records.slice(0, 8);
    return (
      <div className="w-full max-w-md bg-gray-800 rounded-3xl shadow-lg p-4 mt-6 border border-gray-700 mx-auto">
        <div className="font-bold text-gray-50 mb-2 tracking-wide text-base">운동 기록</div>
        {records.length === 0 ? (
          <div className="text-gray-500 text-sm">아직 기록이 없습니다.</div>
        ) : (
          <>
            <ul className={`space-y-2 ${showAllRecords ? 'max-h-96 overflow-y-auto' : ''}`}>
              {visibleRecords.map((r, i) => (
                <li key={i} className="flex justify-between text-sm text-gray-500 border-b last:border-b-0 border-gray-700 pb-1">
                  <span>{r.date}</span>
                  <span className="font-medium">{r.sets}세트/{r.work}s/{r.rest}s</span>
                </li>
              ))}
            </ul>
            {records.length > 8 && (
              <button
                className="mt-3 w-fit mx-auto py-2 px-4 rounded-xl border border-gray-600 bg-transparent text-gray-200 font-semibold text-sm hover:bg-gray-700 transition-all"
                onClick={() => setShowAllRecords(v => !v)}
              >
                {showAllRecords ? '접기' : '더 보기'}
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  // 홈에서 사용한 세팅 H-scroll 표시
  const renderSettings = () => (
    <div className="w-full max-w-md mt-2 mb-4 overflow-x-auto mx-auto">
      <div className="flex gap-2 w-max px-1">
        {settings.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-w-[90px] px-3 py-2 rounded-2xl bg-gray-700 border border-gray-700 shadow text-gray-50 font-semibold text-xs opacity-60 select-none">
            최근 사용한 세팅 없음
          </div>
        ) : (
          settings.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSettingQuickStart(s)}
              className="flex flex-col items-center justify-center min-w-[90px] px-3 py-2 rounded-2xl bg-gray-700 hover:bg-gray-600 border border-gray-700 shadow text-gray-200 font-semibold text-sm transition"
              style={{letterSpacing: '0.01em'}}
            >
              <span className="text-gray-200 font-bold text-base">{s.sets}세트</span>
              <span className="text-gray-400 text-xs">{s.work}s 운동</span>
              <span className="text-gray-400 text-xs">{s.rest}s 휴식</span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // 세팅화면 Back 버튼
  const handleSetupBack = () => setScreen('home');

  // 원형 타이머 컴포넌트
  function CircularTimer({ percent, timeLabel, subLabel, isRest }: { percent: number, timeLabel: string, subLabel?: string, isRest?: boolean }) {
    // 반응형: 최대 320px, 최소 200px
    const size =  Math.max(200, Math.min(320, Math.floor(window.innerWidth * 0.7)));
    const stroke = 7;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - percent);
    // 색상 분기 (휴식: gray scale)
    const progressColor = isRest ? '#A3A3A3' : '#9B8AFB'; // gray-400 or purple
    const bgColor = isRest ? '#E5E7EB' : '#E3D8FF'; // gray-200 or purple-100
    const textColor = isRest ? 'fill-gray-700' : 'fill-gray-50';
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block mx-auto w-full max-w-[320px] h-auto">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s cubic-bezier(0.4,0,0.2,1)' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" dy="-1.6em" className={`${textColor} text-lg font-medium`}>{subLabel}</text>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" dy="0.2em" className={`${textColor} text-5xl font-bold`}>{timeLabel}</text>
      </svg>
    );
  }

  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    if (!soundEnabled) return;
    if (phase === 'work' && isRunning) {
      startAudioRef.current?.play();
    }
    if (phase === 'rest' && setCount === totalSets && !isRunning) {
      endAudioRef.current?.play();
    }
  }, [phase, isRunning, setCount, totalSets, soundEnabled]);

  // 사운드 토글 ON 시 미리듣기
  const handleSoundToggle = async () => {
    setSoundEnabled(v => {
      const next = !v;
      if (!v && startAudioRef.current) {
        startAudioRef.current.currentTime = 0;
        startAudioRef.current.volume = 1;
        startAudioRef.current.play().catch(() => {});
      }
      return next;
    });
  };

  return (
    <div className={`fixed inset-0 w-screen min-h-screen font-sans z-0 bg-gray-900`}>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-screen">
        {screen === 'home' && (
          <div className="w-full max-w-md px-4 mx-auto flex flex-col items-center justify-center min-h-screen">
            <button
              onClick={() => setScreen('setup')}
              className="w-full rounded-full bg-blue-500 text-white font-semibold h-12 px-8 shadow-md hover:bg-blue-600 transition-all duration-200 mb-4 text-xl"
              style={{letterSpacing: '0.03em'}}>
              시작하기
            </button>
            {renderSettings()}
            {renderRecords()}
          </div>
        )}
        {screen === 'setup' && (
          <>
            <button
              onClick={handleSetupBack}
              className="fixed left-4 top-4 text-blue-300 font-semibold px-4 py-2 hover:text-blue-400 transition-all duration-200 z-20"
              style={{letterSpacing: '0.02em', background: 'none', boxShadow: 'none', border: 'none'}}>
              ← Back
            </button>
            <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center">
              <div className="w-full max-w-md px-4 py-12 flex flex-col items-center">
                <div className="text-2xl font-bold mb-6 text-gray-50 tracking-wide">인터벌 타이머 세팅</div>
                <div className="flex flex-col gap-4 w-full">
                  <label className="flex flex-col text-left text-base font-semibold text-gray-200 mb-1 gap-1">
                    운동 시간(초)
                    <input
                      type="number"
                      min={1}
                      value={workInput}
                      onChange={e => setWorkInput(Number(e.target.value))}
                      className="mt-1 px-4 py-3 border border-gray-700 rounded-xl text-lg bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-400 outline-none transition"
                    />
                  </label>
                  <label className="flex flex-col text-left text-base font-semibold text-gray-200 mb-1 gap-1">
                    휴식 시간(초)
                    <input
                      type="number"
                      min={1}
                      value={restInput}
                      onChange={e => setRestInput(Number(e.target.value))}
                      className="mt-1 px-4 py-3 border border-gray-700 rounded-xl text-lg bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-400 outline-none transition"
                    />
                  </label>
                  <label className="flex flex-col text-left text-base font-semibold text-gray-200 mb-1 gap-1">
                    세트 수
                    <input
                      type="number"
                      min={1}
                      value={setsInput}
                      onChange={e => setSetsInput(Number(e.target.value))}
                      className="mt-1 px-4 py-3 border border-gray-700 rounded-xl text-lg bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-400 outline-none transition"
                    />
                  </label>
                </div>
                <button
                  onClick={handleStart}
                  className="w-full rounded-full bg-blue-500 text-white font-semibold h-12 px-8 shadow-md hover:bg-blue-600 transition-all duration-200 mt-8 text-lg"
                  style={{letterSpacing: '0.03em'}}>
                  타이머 시작
                </button>
                <div className="mt-6 flex items-center gap-3">
                  <span className="text-base font-semibold text-gray-200">사운드</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={handleSoundToggle}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-400 rounded-full peer peer-checked:bg-blue-500 transition-all duration-200"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-all duration-200 peer-checked:translate-x-5"></div>
                  </label>
                  <span className={`ml-2 text-xs font-bold align-middle`} style={{minWidth: 28, display: 'inline-block', textAlign: 'center', color: soundEnabled ? '#60A5FA' : '#A3A3A3'}}>{soundEnabled ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>
          </>
        )}
        {screen === 'timer' && (
          <div className="w-full max-w-md px-4 mx-auto flex flex-col items-center justify-center min-h-screen">
            <button
              onClick={handleSetupBack}
              className={`absolute left-4 top-4 text-blue-300 font-semibold px-4 py-2 underline hover:text-blue-400 transition-all duration-200 z-20`}
              style={{letterSpacing: '0.02em', background: 'none', boxShadow: 'none', border: 'none'}}>
              ← Back
            </button>
            <div className="w-full flex flex-col items-center pt-8 pb-8">
              <CircularTimer
                percent={progressPercent}
                timeLabel={formatTime(seconds)}
                subLabel={phase === 'work' ? `${workDuration}초` : `${restDuration}초`}
                isRest={phase === 'rest'}
              />
              <div className="flex flex-col items-center mt-4">
                <div className={`text-sm mb-1 text-gray-300`}>Set {setCount} / {totalSets}</div>
                <div className={`text-lg font-semibold mb-1 text-gray-50`}>{phase === 'work' ? '운동' : '휴식'}</div>
              </div>
              <div className="flex gap-2 w-full mt-8">
                <button
                  onClick={isRunning ? pauseTimer : startTimer}
                  className={`flex-1 rounded-full ${phase === 'rest' ? 'bg-gray-600' : 'bg-blue-500'} text-white font-semibold h-12 px-8 shadow-md hover:bg-blue-600 transition-all duration-200 text-lg`}
                  style={{letterSpacing: '0.03em'}}>
                  {isRunning ? '일시정지' : '시작하기'}
                </button>
              </div>
            </div>
          </div>
        )}
        <audio ref={startAudioRef} src={startSound} preload="auto" muted={false} />
        <audio ref={endAudioRef} src={endSound} preload="auto" muted={false} />
      </div>
    </div>
  )
}

export default App
