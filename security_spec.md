# Security Specification — DRAFT MASTER Firestore Rules

## 1. Data Invariants
1. **PII Isolation**: `/users/{userId}` stores email and private preferences and is strictly readable/writable ONLY by `request.auth.uid == userId`. `/player_profiles/{userId}` contains zero PII.
2. **Identity Integrity**: Every document created by a user enforces `ownerId == request.auth.uid`, `uid == request.auth.uid`, or `whitePlayerId == request.auth.uid` on creation, and immutable owner/creator fields cannot be altered on update.
3. **Terminal State Locking**: Once a match reaches `status == 'completed'` or `status == 'aborted'`, no participant can mutate `boardCompressed`, `turn`, or `winnerSide`. Once a tournament reaches `completed`, bracket results lock.
4. **Master Gate Subcollections**: Access to `/matches/{matchId}/moves/{moveId}` requires fetching `/matches/{matchId}` and verifying the caller is `whitePlayerId` or `blackPlayerId`. Access to `/leagues/{leagueId}/members/{memberId}` requires verifying the parent league exists.
5. **Bounded Arrays & String Lengths**: All string IDs match `^[a-zA-Z0-9_-]+$` and `<= 128` chars. Arrays (`badges`, `unlockedThemes`) are bounded (`<= 50`) and type-checked.
6. **Verified Email Requirement**: All standard writes enforce `request.auth.token.email_verified == true`.
7. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on update; `createdAt` is immutable on update.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Shadow Field Injection on Profile**: Create `/player_profiles/{uid}` with extra field `isAdmin: true`.
2. **Identity Spoofing on Match Create**: Authenticated as `userA`, create `/matches/m1` with `whitePlayerId: "userB"`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to write `/users/{uid}`.
4. **PII Cross-Read**: `userA` attempts `get(/users/userB)`.
5. **ID Poisoning**: Create `/matches/<1500-char-string>` or `/matches/bad$id`.
6. **Terminal State Tampering**: On a `completed` match, `whitePlayerId` attempts to update `winnerSide` to `'white'`.
7. **Oversized String DoS**: Update `player_profiles/{uid}` with `username` of length 500 chars.
8. **Move Injection by Non-Participant**: `userC` attempts to create `/matches/m1/moves/mv1` when players are `userA` and `userB`.
9. **Immutable Timestamp Backdating**: Create `/matches/m2` with `createdAt` set to a client timestamp in 2020 instead of `request.time`.
10. **Owner Hijack on League Update**: League member updates `/leagues/l1` attempting to change `ownerId` to themselves.
11. **Array Flood**: Update `/player_profiles/{uid}` with 100 items in `badges`.
12. **Blanket List Query Bypass**: Unauthenticated user attempts `list` on `/users`.
