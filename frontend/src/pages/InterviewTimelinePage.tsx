import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterviewEvents, toggleEventBookmark, getRoundForInterview } from '../api';
import { SkeletonCard } from '../components/ui/Skeleton';
import {
  Play, Terminal, Monitor, PenLine, ClipboardCheck, Square,
  Bookmark, Circle, Star, ArrowLeft,
} from 'lucide-react';

interface InterviewEvent {
  id: string;
  roundId: string;
  eventType: string;
  actorRole: string;
  actorName: string | null;
  metadata: string | null;
  bookmarked: boolean;
  bookmarkNote: string | null;
  createdAt: string;
}

interface RoundInfo {
  candidateName?: string;
  positionTitle?: string;
  scheduledAt?: string;
  type?: string;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; dotColor: string }> = {
  INTERVIEW_STARTED: {
    label: 'Interview Started',
    icon: <Play size={14} />,
    dotColor: 'bg-green-500',
  },
  CODE_RAN: {
    label: 'Code Executed',
    icon: <Terminal size={14} />,
    dotColor: 'bg-blue-500',
  },
  SCREEN_SHARE_STARTED: {
    label: 'Screen Share Started',
    icon: <Monitor size={14} />,
    dotColor: 'bg-purple-500',
  },
  WHITEBOARD_USED: {
    label: 'Whiteboard Used',
    icon: <PenLine size={14} />,
    dotColor: 'bg-orange-500',
  },
  SCORE_SUBMITTED: {
    label: 'Scorecard Submitted',
    icon: <ClipboardCheck size={14} />,
    dotColor: 'bg-yellow-500',
  },
  INTERVIEW_ENDED: {
    label: 'Interview Ended',
    icon: <Square size={14} />,
    dotColor: 'bg-red-500',
  },
  BOOKMARK: {
    label: 'Bookmark',
    icon: <Bookmark size={14} />,
    dotColor: 'bg-yellow-400',
  },
};

function getEventConfig(eventType: string) {
  return EVENT_CONFIG[eventType] ?? {
    label: 'Event',
    icon: <Circle size={14} />,
    dotColor: 'bg-gray-500',
  };
}

function formatRelativeTime(firstTs: string, ts: string): string {
  const first = new Date(firstTs).getTime();
  const current = new Date(ts).getTime();
  const diffSec = Math.max(0, Math.floor((current - first) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatAbsoluteTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function InterviewTimelinePage() {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();

  const [events, setEvents] = useState<InterviewEvent[]>([]);
  const [roundInfo, setRoundInfo] = useState<RoundInfo>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    if (!roundId) return;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [eventsRes, roundRes] = await Promise.allSettled([
          getInterviewEvents(roundId),
          getRoundForInterview(roundId),
        ]);

        if (eventsRes.status === 'fulfilled') {
          setEvents(eventsRes.value.data ?? []);
        } else {
          setError((eventsRes.reason as any)?.response?.data?.error || 'Failed to load events.');
        }

        if (roundRes.status === 'fulfilled') {
          const round = roundRes.value?.round;
          setRoundInfo({
            candidateName: round?.application?.candidateName,
            positionTitle: round?.application?.position?.title,
            scheduledAt: round?.scheduledAt,
            type: round?.type,
          });
        }
      } catch {
        setError('Failed to load timeline.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [roundId]);

  const handleToggleBookmark = async (event: InterviewEvent) => {
    setBookmarkingId(event.id);
    const newBookmarked = !event.bookmarked;
    // Optimistic update
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, bookmarked: newBookmarked } : e));
    try {
      const res = await toggleEventBookmark(roundId!, event.id, { bookmarked: newBookmarked });
      setEvents(prev => prev.map(e => e.id === event.id ? res.data : e));
    } catch {
      // Revert
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, bookmarked: event.bookmarked } : e));
    }
    setBookmarkingId(null);
  };

  const handleSaveNote = async (event: InterviewEvent) => {
    setBookmarkingId(event.id);
    try {
      const res = await toggleEventBookmark(roundId!, event.id, {
        bookmarked: true,
        bookmarkNote: noteInput,
      });
      setEvents(prev => prev.map(e => e.id === event.id ? res.data : e));
    } catch {}
    setEditingNoteId(null);
    setNoteInput('');
    setBookmarkingId(null);
  };

  const displayed = bookmarksOnly ? events.filter(e => e.bookmarked) : events;
  const firstTs = events[0]?.createdAt ?? null;

  const roundTypeLabel: Record<string, string> = {
    TECHNICAL_INTERVIEW: 'Technical Interview',
    HR_INTERVIEW: 'HR Interview',
    FINAL_INTERVIEW: 'Final Interview',
    TEST: 'Online Assessment',
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="w-px h-5 bg-gray-700" />
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold">Interview Timeline</h1>
          {roundInfo.candidateName && (
            <p className="text-xs text-gray-400 mt-0.5">
              {roundInfo.candidateName}
              {roundInfo.positionTitle && <> · <span className="text-gray-500">{roundInfo.positionTitle}</span></>}
              {roundInfo.type && <> · <span className="text-yellow-400">{roundTypeLabel[roundInfo.type] ?? roundInfo.type}</span></>}
              {roundInfo.scheduledAt && (
                <> · <span className="text-gray-500">{new Date(roundInfo.scheduledAt).toLocaleDateString()}</span></>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!loading && events.length > 0 && (
            <span className="text-xs text-gray-500">
              {events.length} event{events.length !== 1 ? 's' : ''}
              {events.filter(e => e.bookmarked).length > 0 && (
                <> · <span className="text-yellow-400">{events.filter(e => e.bookmarked).length} bookmarked</span></>
              )}
            </span>
          )}
          <button
            onClick={() => setBookmarksOnly(b => !b)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              bookmarksOnly
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-700'
                : 'bg-gray-700 text-gray-400 border-gray-600 hover:text-white'
            }`}
          >
            <Star size={12} />
            {bookmarksOnly ? 'All Events' : 'Bookmarks Only'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 p-6 space-y-4 max-w-3xl mx-auto w-full">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-6 py-4 rounded-xl text-sm max-w-md text-center">
            {error}
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && events.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-300 font-medium text-lg">No events recorded yet</p>
            <p className="text-gray-500 text-sm mt-2">Events will appear here as the interview progresses.</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-6 px-5 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-colors"
            >
              ← Go Back
            </button>
          </div>
        </div>
      )}

      {/* Empty bookmarks filter */}
      {!loading && !error && events.length > 0 && displayed.length === 0 && bookmarksOnly && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Star size={40} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No bookmarked events</p>
            <p className="text-gray-600 text-sm mt-1">Bookmark key moments from the timeline to see them here.</p>
            <button
              onClick={() => setBookmarksOnly(false)}
              className="mt-4 px-4 py-2 text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Show all events
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {!loading && !error && displayed.length > 0 && (
        <div className="flex-1 overflow-y-auto py-6">
          <div className="max-w-3xl mx-auto px-6">
            <div className="relative">
              {/* Vertical connector */}
              <div className="absolute left-3.5 top-4 bottom-4 w-px bg-gray-700" />

              <div className="space-y-0">
                {displayed.map((event, idx) => {
                  const config = getEventConfig(event.eventType);
                  const meta = parseMetadata(event.metadata);
                  const isBookmarking = bookmarkingId === event.id;
                  const isEditingNote = editingNoteId === event.id;

                  return (
                    <div
                      key={event.id}
                      className={`relative flex gap-4 pb-6 ${
                        event.bookmarked ? 'border-l-2 border-yellow-500 pl-3 -ml-3' : ''
                      }`}
                    >
                      {/* Dot */}
                      <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-lg ${config.dotColor}`}
                        style={{ marginTop: 2 }}>
                        {config.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 hover:border-gray-600 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-medium text-sm">{config.label}</span>
                              {event.bookmarked && (
                                <span className="inline-flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-700 px-2 py-0.5 rounded-full font-medium">
                                  <Star size={10} fill="currentColor" />
                                  Bookmarked
                                </span>
                              )}
                              {meta?.recommendation && (
                                <span className="text-xs text-blue-400 bg-blue-900/50 border border-blue-700 px-2 py-0.5 rounded-full">
                                  {String(meta.recommendation)}
                                </span>
                              )}
                              {meta?.language && (
                                <span className="text-xs text-gray-400 bg-gray-700 border border-gray-600 px-2 py-0.5 rounded-full font-mono">
                                  {String(meta.language)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {event.actorName && (
                                <span className="text-xs text-gray-400">{event.actorName}</span>
                              )}
                              <span className="text-xs text-gray-600 bg-gray-700/50 px-1.5 py-0.5 rounded font-mono">
                                {event.actorRole}
                              </span>
                              {meta?.note && (
                                <span className="text-xs text-gray-300 italic">"{String(meta.note)}"</span>
                              )}
                            </div>
                            {/* Bookmark note */}
                            {event.bookmarked && event.bookmarkNote && !isEditingNote && (
                              <div className="mt-2 flex items-start gap-1.5">
                                <Bookmark size={11} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-yellow-300 italic">{event.bookmarkNote}</span>
                                <button
                                  onClick={() => { setEditingNoteId(event.id); setNoteInput(event.bookmarkNote ?? ''); }}
                                  className="text-xs text-gray-500 hover:text-gray-300 underline ml-1"
                                >
                                  edit
                                </button>
                              </div>
                            )}
                            {/* Edit note form */}
                            {isEditingNote && (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={noteInput}
                                  onChange={e => setNoteInput(e.target.value)}
                                  placeholder="Add bookmark note..."
                                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-600"
                                  autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(event); if (e.key === 'Escape') { setEditingNoteId(null); setNoteInput(''); } }}
                                />
                                <button
                                  onClick={() => handleSaveNote(event)}
                                  disabled={isBookmarking}
                                  className="px-2.5 py-1.5 text-xs font-semibold bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => { setEditingNoteId(null); setNoteInput(''); }}
                                  className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {/* Add note prompt (bookmarked but no note yet) */}
                            {event.bookmarked && !event.bookmarkNote && !isEditingNote && (
                              <button
                                onClick={() => { setEditingNoteId(event.id); setNoteInput(''); }}
                                className="mt-1.5 text-xs text-gray-500 hover:text-yellow-400 transition-colors"
                              >
                                + Add bookmark note
                              </button>
                            )}
                          </div>

                          {/* Right column: timestamps + bookmark toggle */}
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="text-right">
                              {firstTs && (
                                <p className="text-xs font-mono text-yellow-400">
                                  +{formatRelativeTime(firstTs, event.createdAt)}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 font-mono">
                                {formatAbsoluteTime(event.createdAt)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleToggleBookmark(event)}
                              disabled={isBookmarking}
                              title={event.bookmarked ? 'Remove bookmark' : 'Bookmark this event'}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                                event.bookmarked
                                  ? 'text-yellow-400 hover:text-yellow-300 bg-yellow-500/10'
                                  : 'text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10'
                              }`}
                            >
                              <Star size={14} fill={event.bookmarked ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
