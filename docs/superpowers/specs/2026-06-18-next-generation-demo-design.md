# Next Generation Demo Page Design

## Goal

Create a temporary `/next/demo` page for an in-person next-generation ministry demonstration where children can join on phones and teachers can see the full app flow.

## Audience And Setting

- The main screen is projected from a teacher/demo computer.
- Children may scan a QR code and complete real sign-up on their phones.
- Children without phones can follow the projected demo or use a teacher device.

## Flow

1. QR and real sign-up
   - Show a large QR code and short URL for `/next/demo`.
   - Explain Google login, name/department confirmation, and sign-up request.
   - Provide a button that opens the existing real next-generation login/sign-up modal.

2. Bible reading chart
   - Show a demo bookshelf with several books highlighted.
   - Explain that children can view it from My Page after sign-up.
   - Explain that pastors/admins record completed books.
   - Mention that weekday follow-up can be left through the app Contact page.

3. This week's curriculum
   - Link into the real elementary board workbook tab at `/next/elementary?resource=elementary_workbook`.
   - The presenter can click real curriculum posts and view their details.
   - Provide a clear way back to `/next/demo`.

4. Word Fruit
   - Use the existing visual tree style to demonstrate the fruit growing through stages.
   - Keep state local only; do not write Firestore data.

5. Questions
   - Demonstrate a question card being submitted and awaiting teacher/pastor response.
   - Keep state local only.

6. Family worship
   - Present this as the existing strip/banner style.
   - Explain that families can view resources, write a worship record, and upload a proof photo.
   - Keep state local only.

## Technical Boundaries

- Actual flows: sign-up modal entry and real curriculum tab navigation.
- Demo-only flows: Bible reading chart animation, Word Fruit growth, question card, and family worship record/proof-photo preview.
- No Firestore writes should happen from the demo-only scenes.
- The page should reuse existing next-generation colors and assets where practical.
