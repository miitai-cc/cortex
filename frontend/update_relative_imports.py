import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    modified = False
    
    # We want to replace paths like:
    # import X from '../components/...';
    # import X from '../../services/...';
    
    def replacer(match):
        nonlocal modified
        full_match = match.group(0)
        prefix = match.group(1) # 'import ' or 'from '
        quote = match.group(2)  # ' or "
        path = match.group(3)   # ../components/...
        
        # If the path starts with '../', we add another '../'
        if path.startswith('../'):
            new_path = '../' + path
            modified = True
            return f"{prefix}{quote}{new_path}{quote}"
            
        return full_match

    # Match imports and exports
    new_content = re.sub(r'''(from\s+)(['"])(../[^'"]+)['"]''', replacer, content)
    new_content = re.sub(r'''(import\s+)(['"])(../[^'"]+)['"]''', replacer, new_content)
    new_content = re.sub(r'''(import\()(['"])(../[^'"]+)['"]\)''', replacer, new_content)
    
    if modified:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('/Volumes/workspace/ai/application/cortex/frontend/src/pages'):
    # only process files in subdirectories of pages, not in pages itself
    if root == '/Volumes/workspace/ai/application/cortex/frontend/src/pages':
        continue
        
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
