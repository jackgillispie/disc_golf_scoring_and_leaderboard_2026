
arr = []
with open("C:/Users/jackg/Downloads/Pipe Puffers.txt", "r") as file:
    for line in file:
        arr.append(line)

print(len(arr))
result = list(set(arr))
print(len(result))

with open("C:/Users/jackg/Downloads/Pipe Puffers.txt", "w+") as file:
    for name in result:
        file.write(name)
