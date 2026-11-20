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

with open("C:/Users/jackg/Downloads/ordered_tokens.txt", "w+") as file:
    for i in arr:
        file.write(i + "\n")

"""
with open("C:/Users/jackg/Downloads/revamp_token_frontend.txt", "w+") as file:
    file.write("{")
    for i in range(len(grp)):
            file.write(f"'{arr[i]}': {{'group': '{grp[i]}'}}, ")
    file.write("}")

"""
