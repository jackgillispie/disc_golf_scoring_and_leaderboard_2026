from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import re
import os
import sys

##TODO  having trouble removign [ and ] from the first and last lines, in addition to getting " around
# the URLs reliably, writing double lines for all the elements below the starting point 


#config for running function find/replace against file
my_replacements = []


target_pattern = r'<div class="vendor-track">'

#for scraping carousel off LKNITP
#target_pattern = r'src=".*?"'

### NOTE Custom prefix/suffix needs to happen when we append to my_replacements below
target_file_path = 'C:/Users/jackg/Desktop/disc_golf_2026/google_app_script/vendor_pastebin.html'



def get_datapoints_from_file(file_name):
    results = []
    counter = 1
    with open(file_name) as file:
        for line in file:
            results.append(
            '''<div class="slide">
    <img
    decoding="async"
    src="''' + line.strip() + '"'.strip() + f'''
    alt="Vendor {counter}"
    />
</div>
''')
            counter+=1
    return results



#for scraping replacement URLS. Modify based on your website

def perm_check(file_path):


    readable = os.access(file_path, os.R_OK)
        # Check for Write access
    writable = os.access(file_path, os.W_OK)
        
    if not readable:
        print(f"Error: No read access for {file_path}")
        sys.exit()
    if not writable:
        print(f"Error: No write access for {file_path}")
        sys.exit()






def insert_lines_with_array(file_path, pattern, replacement_values):

    if replacement_values == []:
        print("replacement values is empty, exiting")
        sys.exit()

    
    temp_file = file_path + ".tmp"
    repl_index = 0
    num_replacements = len(replacement_values)

    try:
        with open(file_path, 'r') as f_in, open(temp_file, 'w') as f_out:
            
            found_pattern = False
            added_data = False
            
            for line in f_in:
                #find insert point by checking if the line matches the pattern
                if found_pattern is False:
                    if re.search(pattern, line):
                        found_pattern = True
                        print(line)
                    else:
                        print(line)
                        
                if found_pattern is True:
                    if added_data is True:
                        print(line)
                    if added_data is False:
                    #iterate through data and adds after writing the previous match
                        for value in replacement_values:
                            print(value)
                        added_data = True

        # Replace the original file with the modified temporary file
        print(f"Successfully updated {file_path}.")

    except Exception as e:
        if os.path.exists(temp_file):
            os.remove(temp_file)
        print(f"An error occurred: {e}")               
                        


                
    #iterate through data and add

# --- Example Usage ---
# Suppose 'data.txt' contains lines like: ID_PLACEHOLDER


perm_check(target_file_path)
my_replacements = get_datapoints_from_file("C:/Users/jackg/Downloads/new_carousel_logos.txt")
print(my_replacements[0])
insert_lines_with_array(target_file_path, target_pattern, my_replacements)


"""

lines=["a,", "b,", "c,", "d,"]
for i in range (1):
    for i in range (1):
            for line in lines:
                first='''<div class="slide">
                <img decoding="async"
                src="''' + line.rstrip(",") +'''"
                alt="Vendor 1"/>
            </div>
                '''
                print(first)
"""
