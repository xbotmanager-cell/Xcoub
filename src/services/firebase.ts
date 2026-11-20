import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { VariantPreset } from '../engine/types.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationTypeValue;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationTypeValue,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface CloudPlayerProfile {
  uid: string;
  username: string;
  avatarUrl?: string;
  country?: string;
  eloEnglish: number;
  eloInternational: number;
  eloCustom: number;
  peakElo: number;
  xp: number;
  level: number;
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  favoriteVariant: VariantPreset;
  badges: string[];
  unlockedThemes: string[];
  selectedBoardTheme: string;
  selectedPieceTheme: string;
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function ensureCloudProfile(
  user: User,
  localFallback?: Partial<CloudPlayerProfile>
): Promise<CloudPlayerProfile> {
  const userPath = `users/${user.uid}`;
  const profilePath = `player_profiles/${user.uid}`;

  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (!userSnap.exists()) {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: (user.email ?? 'player@draftmaster.app').slice(0, 254),
        displayName: (user.displayName ?? 'Grandmaster').slice(0, 64),
        photoURL: (user.photoURL ?? '').slice(0, 512),
        country: localFallback?.country ?? 'Global',
        themePreference: 'dark',
        soundEnabled: true,
        voiceCoachEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    // Do not crash guest/offline experience if unverified or offline
    console.warn('Private user doc sync skipped:', err);
  }

  try {
    const profRef = doc(db, 'player_profiles', user.uid);
    const profSnap = await getDoc(profRef);
    if (profSnap.exists()) {
      const data = profSnap.data();
      return {
        uid: String(data.uid),
        username: String(data.username),
        avatarUrl: data.avatarUrl ? String(data.avatarUrl) : undefined,
        country: data.country ? String(data.country) : 'Global',
        eloEnglish: Number(data.eloEnglish ?? 1200),
        eloInternational: Number(data.eloInternational ?? 1200),
        eloCustom: Number(data.eloCustom ?? 1200),
        peakElo: Number(data.peakElo ?? 1200),
        xp: Number(data.xp ?? 0),
        level: Number(data.level ?? 1),
        totalGames: Number(data.totalGames ?? 0),
        wins: Number(data.wins ?? 0),
        draws: Number(data.draws ?? 0),
        losses: Number(data.losses ?? 0),
        favoriteVariant: (data.favoriteVariant as VariantPreset) ?? 'english_8x8',
        badges: Array.isArray(data.badges) ? data.badges : [],
        unlockedThemes: Array.isArray(data.unlockedThemes) ? data.unlockedThemes : ['walnut'],
        selectedBoardTheme: String(data.selectedBoardTheme ?? 'walnut'),
        selectedPieceTheme: String(data.selectedPieceTheme ?? 'obsidian_ivory'),
      };
    }

    const cleanUsername = (user.displayName ?? 'Player')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .slice(0, 32) || 'Player';

    const initialProfile: CloudPlayerProfile = {
      uid: user.uid,
      username: cleanUsername.length >= 2 ? cleanUsername : 'Player',
      avatarUrl: (user.photoURL ?? '').slice(0, 512),
      country: localFallback?.country ?? 'Global',
      eloEnglish: localFallback?.eloEnglish ?? 1200,
      eloInternational: localFallback?.eloInternational ?? 1200,
      eloCustom: localFallback?.eloCustom ?? 1200,
      peakElo: localFallback?.peakElo ?? 1200,
      xp: localFallback?.xp ?? 0,
      level: localFallback?.level ?? 1,
      totalGames: localFallback?.totalGames ?? 0,
      wins: localFallback?.wins ?? 0,
      draws: localFallback?.draws ?? 0,
      losses: localFallback?.losses ?? 0,
      favoriteVariant: localFallback?.favoriteVariant ?? 'english_8x8',
      badges: localFallback?.badges?.slice(0, 50) ?? ['Welcome Competitor'],
      unlockedThemes: localFallback?.unlockedThemes?.slice(0, 30) ?? ['walnut', 'slate'],
      selectedBoardTheme: localFallback?.selectedBoardTheme ?? 'walnut',
      selectedPieceTheme: localFallback?.selectedPieceTheme ?? 'obsidian_ivory',
    };

    await setDoc(profRef, {
      ...initialProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return initialProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${profilePath} / ${userPath}`);
  }
}

export async function updateCloudProfileStats(
  uid: string,
  updates: Partial<CloudPlayerProfile>
): Promise<void> {
  const path = `player_profiles/${uid}`;
  try {
    const sanitized: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (typeof updates.username === 'string') sanitized.username = updates.username.slice(0, 32);
    if (typeof updates.country === 'string') sanitized.country = updates.country.slice(0, 64);
    if (typeof updates.eloEnglish === 'number') sanitized.eloEnglish = Math.max(100, Math.min(4000, updates.eloEnglish));
    if (typeof updates.eloInternational === 'number') sanitized.eloInternational = Math.max(100, Math.min(4000, updates.eloInternational));
    if (typeof updates.eloCustom === 'number') sanitized.eloCustom = Math.max(100, Math.min(4000, updates.eloCustom));
    if (typeof updates.peakElo === 'number') sanitized.peakElo = Math.max(100, Math.min(4000, updates.peakElo));
    if (typeof updates.xp === 'number') sanitized.xp = Math.max(0, updates.xp);
    if (typeof updates.level === 'number') sanitized.level = Math.max(1, updates.level);
    if (typeof updates.totalGames === 'number') sanitized.totalGames = Math.max(0, updates.totalGames);
    if (typeof updates.wins === 'number') sanitized.wins = Math.max(0, updates.wins);
    if (typeof updates.draws === 'number') sanitized.draws = Math.max(0, updates.draws);
    if (typeof updates.losses === 'number') sanitized.losses = Math.max(0, updates.losses);
    if (updates.favoriteVariant) sanitized.favoriteVariant = updates.favoriteVariant;
    if (Array.isArray(updates.badges)) sanitized.badges = updates.badges.slice(0, 50);
    if (Array.isArray(updates.unlockedThemes)) sanitized.unlockedThemes = updates.unlockedThemes.slice(0, 30);
    if (typeof updates.selectedBoardTheme === 'string') sanitized.selectedBoardTheme = updates.selectedBoardTheme.slice(0, 40);
    if (typeof updates.selectedPieceTheme === 'string') sanitized.selectedPieceTheme = updates.selectedPieceTheme.slice(0, 40);

    await updateDoc(doc(db, 'player_profiles', uid), sanitized);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchGlobalLeaderboard(): Promise<CloudPlayerProfile[]> {
  const path = 'player_profiles';
  try {
    const q = query(collection(db, path), orderBy('eloEnglish', 'desc'), limit(25));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CloudPlayerProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}
