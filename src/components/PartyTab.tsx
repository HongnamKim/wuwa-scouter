import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../state/store';
import { memberProvidedBuffsFor } from '../state/store';
import type { PartyMember } from '../engine/context';
import type { Buff } from '../types/data';
import { loadCharacters } from '../engine/loadData';
import { isReleased } from '../engine/release';
import { ConfirmModal } from './ConfirmModal';
import { Dropdown } from './Dropdown';

const valText = (b: Buff) => (b.type.startsWith('flat') ? String(b.value) : `${+(b.value * 100).toFixed(1)}%`);
// 파티원 제공 버프 설명. label(풀)/short(간략) 우선({v} 치환), 없으면 유형+수치. next_character는 표시로 구분.
const fullOf = (b: Buff) => (b.label ? b.label.replace('{v}', valText(b)) : `${b.type} +${valText(b)}`);
const shortOf = (b: Buff) => (b.short ? b.short.replace('{v}', valText(b)) : fullOf(b));
const buffText = (b: Buff, simple: boolean) =>
  (simple ? shortOf(b) : fullOf(b)) + (b.target === 'next_character' ? ' (다음 캐릭터)' : '');

interface Props { state: AppState; setState: (s: AppState) => void; simple: boolean; }

const MAX_PARTY = 2;

/** 파티 탭: 파티원(최대 2) 편성 + 각 파티원의 party/next 버프 적용 토글. */
export function PartyTab({ state, setState, simple }: Props) {
  const navigate = useNavigate();
  const [moveTo, setMoveTo] = useState<string | null>(null); // 칩 클릭 시 이동 확인 대상
  const chars = loadCharacters();
  const members = state.partyMembers ?? [];
  const moveTarget = moveTo ? chars.find((c) => c.id === moveTo) : null;

  const setMembers = (pm: PartyMember[]) => setState({ ...state, partyMembers: pm });
  const addMember = (id: string) => {
    if (members.length >= MAX_PARTY || members.some((m) => m.id === id)) return;
    setMembers([...members, { id, disabled: [] }]); // 기본 전부 적용
  };
  const removeMember = (id: string) => setMembers(members.filter((m) => m.id !== id));
  // 파티원의 특정 제공 버프 on/off (disabled 목록으로 관리)
  const toggleBuff = (memberId: string, key: string, on: boolean) =>
    setMembers(members.map((m) => {
      if (m.id !== memberId) return m;
      const off = new Set(m.disabled ?? []);
      if (on) off.delete(key); else off.add(key);
      return { ...m, disabled: [...off] };
    }));

  // 선택 가능: 현재 캐릭터·이미 편성된 파티원 제외, 버전 내림차순 → 이름순
  const available = chars
    .filter((c) => c.id !== state.character.id && !members.some((m) => m.id === c.id) && isReleased(c))
    .sort((a, b) => b.version - a.version || a.name.localeCompare(b.name));

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <Dropdown
          value=""
          disabled={members.length >= MAX_PARTY || available.length === 0}
          placeholder={members.length >= MAX_PARTY ? '파티 가득 참(최대 2)' : available.length === 0 ? '추가할 공명자 없음' : '+ 파티원 추가'}
          options={available.map((c) => ({ value: c.id, label: c.name, image: `/characters/${c.id}.webp`, group: `${Math.floor(c.version)}버전` }))}
          onChange={(id) => { if (id) addMember(id); }}
        />
      </div>

      {members.length === 0 ? (
        <div className="muted">파티에 편성할 공명자를 선택해주세요.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {members.map((m) => {
              const c = chars.find((x) => x.id === m.id);
              return (
                <span key={m.id} className="party-chip" onClick={() => setMoveTo(m.id)} title="이 캐릭터로 이동">
                  {c?.name ?? m.id}
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeMember(m.id); }} aria-label="삭제">×</button>
                </span>
              );
            })}
          </div>

          {members.map((m) => {
            const c = chars.find((x) => x.id === m.id);
            if (!c) return null;
            // specific_character 버프는 지금 보는 캐릭터가 그 지정 대상일 때만 노출·토글
            const provided = memberProvidedBuffsFor(c)
              .filter(({ buff }) => buff.target !== 'specific_character' || buff.target_character === state.character.id);
            const off = new Set(m.disabled ?? []);
            return (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <div className="muted" style={{ fontWeight: 'bold', margin: '2px 0 4px' }}>{c.name}</div>
                {provided.length === 0 && (
                  <div className="muted" style={{ fontSize: '0.85rem' }}>제공하는 파티 버프가 없습니다.</div>
                )}
                {provided.map(({ key, buff, source, scaledValue }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                    <input type="checkbox" checked={!off.has(key)} onChange={(e) => toggleBuff(m.id, key, e.target.checked)} />
                    <span>
                      <span className="muted" style={{ fontSize: '0.78rem', marginRight: 4 }}>[{source}]</span>
                      {buffText(buff, simple)}
                      {scaledValue != null && (
                        <span className="muted" style={{ fontSize: '0.78rem', marginLeft: 4 }}>· 현재 {+(scaledValue * 100).toFixed(1)}%</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            );
          })}
        </>
      )}

      {moveTarget && (
        <ConfirmModal
          message={`${moveTarget.name}(으)로 이동하시겠습니까?`}
          confirmLabel="이동"
          onConfirm={() => { const id = moveTarget.id; setMoveTo(null); navigate(`/analysis/${id}`); }}
          onCancel={() => setMoveTo(null)}
          onDismiss={() => setMoveTo(null)}
        />
      )}
    </div>
  );
}
