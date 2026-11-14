# Field Shift Firestore Security Specification

## 1. Data Invariants
1. User profile documents at `/users/{userId}` can only be read, created, or updated by the verified authenticated owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`).
2. All farm documents (`/users/{userId}/farms/{farmId}`) and farm subcollections (`environmentalRecords`, `scans`, `decisions`, `reports`) are strictly isolated to the owning user (`userId == request.auth.uid` and `data.ownerId == request.auth.uid`).
3. Subcollection records (`environmentalRecords`, `scans`, `decisions`, `reports`) verify parent farm existence via `exists(/databases/$(database)/documents/users/$(userId)/farms/$(farmId))` and enforce `data.farmId == farmId`.
4. All document IDs (`userId`, `farmId`, `recordId`, `scanId`, `decisionId`, `reportId`) must match `^[a-zA-Z0-9_\\-]+$` and have length `<= 128`.
5. All `createdAt` and `updatedAt` timestamps must match server `request.time`, and `ownerId` and `createdAt` are immutable after creation.
6. Every document creation enforces exact required and allowed key sets (`keys().hasAll(...) && keys().hasOnly(...)`) to reject shadow fields.

## 2. Adversarial "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read of `/users/u1/farms/f1`.
2. Authenticated User B reading User A's farm `/users/userA/farms/farm1` (location privacy breach).
3. Unverified email user (`email_verified: false`) creating `/users/userA/farms/farm1`.
4. Identity spoofing: User A creating `/users/userA/farms/farm1` with `ownerId: "userB"`.
5. Shadow field injection: User A creating a farm with extra `isAdmin: true` or `verifiedPartner: true`.
6. ID poisoning: User A creating `/users/userA/farms/../../../etc/passwd` or 500-char ID.
7. Oversized boundary array (> 50 vertex points) or oversized farm name (> 120 chars).
8. Client-forged `createdAt` timestamp not equal to `request.time`.
9. Mutating immutable `ownerId` or `createdAt` on farm `update`.
10. Orphaned subcollection write: creating `/users/userA/farms/nonexistent/scans/s1`.
11. Cross-farm subcollection mismatch: creating scan under `farm1` with `farmId: "farm2"`.
12. Invalid crop enum (`previousCrop: "banana"`) or invalid report mode (`mode: "marketing"`).
