# Security Specification - ND Studio Pro

## 1. Data Invariants
- A user document must exist for every authenticated user who uses the app.
- Only the admin (`nanda220399@gmail.com`) can approve or reject users.
- Users can only read and write their own data.
- The `role` and `isApproved` fields are immutable for regular users.
- `uid` and `email` fields must match the authenticated user's token.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Attempt to create a user doc with a different UID.
2. **Privilege Escalation**: User tries to set `role: 'admin'` or `isApproved: true` on creation.
3. **Data Pollution**: Injecting a extremely large string into the `apiKey` field.
4. **Unauthorized Read**: User A tries to read User B's profile.
5. **Unauthorized Update**: User A tries to change User B's `apiKey`.
6. **Bypassing Approval**: User tries to set `isApproved: true` via an update.
7. **Malicious ID**: Attempt to create a user document with a 1MB string as the ID.
8. **Field Injection**: Adding a "isVerified: true" field to the user doc.
9. **Role Hijacking**: Authenticated user tries to update their own role to 'admin'.
10. **Timestamp Spoofing**: User tries to set `createdAt` to a date in the past.
11. **Admin Impersonation**: User tries to perform admin actions (like listing all users) without being the admin.
12. **Orphaned Writes**: (N/A as there are no subcollections, but good to keep in mind).

## 3. Test Runner
(I will generate the `firestore.rules.test.ts` logic conceptually in my head or into a file if I can run it, but since I don't have a test environment for rules here, I will focus on the rules code).
