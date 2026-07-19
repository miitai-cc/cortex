import re

filepath = '/Volumes/workspace/ai/application/cortex/frontend/src/pages/workspace/DepartmentPortalPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix statuses/priorities label property lookup
content = content.replace("?.label ?? value;", "?.labelKey ?? value;")

# Fix isEn scope. I put `const isEn` right after `const { t, i18n }`. It should be visible everywhere inside the component.
# Let's ensure it's there.
if "const isEn" not in content:
    content = content.replace(
        "const { t, i18n } = useTranslation();",
        "const { t, i18n } = useTranslation();\n  const isEn = i18n.language?.startsWith('en');"
    )

# Fix `{t(status.labelKey)}` and `{t(priority.labelKey)}` which might be broken
# wait, where is `{t(status.labelKey)}` ?
# The error says: `Cannot find name 'isEn'` around line 427. 
# Ah, it's inside a callback or form block? No, it's inside `return` of the component.
# Let me check if there's multiple `useTranslation` or multiple components in the file.

match = re.search(r'export default function DepartmentPortalPage\(\) \{', content)
if not match:
    print("Could not find DepartmentPortalPage component")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated statusLabel/priorityLabel and checked isEn.")
