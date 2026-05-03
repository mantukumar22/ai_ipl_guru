# Firestore Security Specification - IPL AI Akinator

## 1. Data Invariants
- A session must have a `status` and a `createdAt` timestamp.
- Users can create and read their own sessions (or all if public anonymous play).
- Questions in a session are immutable once added (except by the session owner during the game loop).
- Feedback is append-only for active sessions that ended improperly.

## 2. "Dirty Dozen" Payloads (Denial Tests)
1. **Unauthorized Session Hijack**: Attempt to read session `abc` as user `xyz`.
2. **Status Poisoning**: Attempt to set status to `invalid_status`.
3. **Question Spam**: Attempt to add 1000 questions in one update.
4. **Identity Spoofing**: Attempt to set `userId` to another user's ID.
5. **Timestamp Fraud**: Setting `createdAt` to a future date.
6. **Negative Confidence**: Setting `confidence` to -20.
7. **Ghost Field**: Adding `isAdmin: true` to a session.
8. **Feedback Injection**: Creating feedback with a 1MB payload.
9. **Session Deletion**: Normal users should not delete sessions.
10. **Global Read**: Attempting to list all sessions without a specific userId filter.
11. **Update Lockout**: Attempting to change `createdAt` on update.
12. **Confidence Overflow**: Setting confidence to 200%.

## 3. Test Runner (Mock)
(Handled by the logic in `firestore.rules`)
