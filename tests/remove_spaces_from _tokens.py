from pathlib import Path


arr = []

def rep(line):
    return line.replace(" ", "-")

try:
    with open(Path("C:/Users/jackg/Downloads/Pipe Puffers.txt"), "r") as file:
        for line in file:
            arr.append(line)
    arr = list(map(rep, arr))

    print(arr[1])
    with open(Path("C:/Users/jackg/Downloads/tokens_tmp.txt"), "w+") as file:
        for line in arr:
            file.write(line)
            
except Exception as e:
    print(e)
