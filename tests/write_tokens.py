import json


#TODO Handle reaching oob conditions in loop when many more file lines,
# or vice versa

grp = []
for num in range(1, 19):
    for id in ["A", "B", "C", "D"]:
        grp.append(f"{num}{id}")

arr = []
with open("C:/Users/jackg/Downloads/tokens_tmp.txt", "r") as file:
    for line in file:
        arr.append(line.rstrip())
# sort alphabetically before making additions
#
arr.sort()
print(f"{len(arr), arr[0:5]}")
#
with open("C:/Users/jackg/Downloads/valid_tokens_appscript.txt", "w+") as file:
    file.write("[")
    for line in arr:
        file.write(f"'{line}', ".rstrip("\n"))
    file.write("]")

with open("C:/Users/jackg/Downloads/other_format_tokens.txt", "w+") as file:
    file.write("[")
    grp_assn = 0

    for line in arr:
        file.write(f"{{'token': '{line}', 'group': '{grp[grp_assn]}'}}, ".rstrip("\n"))
        grp_assn+=1
    file.write("]")

result = {}
for item in arr:
    result[item] = {"group": item, "tourn": "LKNITP Disc Bash 2026"}
result = json.dumps(result, indent=4)
with open("C:/Users/jackg/Downloads/tokens.txt", "w+") as file:
    file.write(result)
