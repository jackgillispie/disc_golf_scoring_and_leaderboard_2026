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


def get_lines_from_file(file_name):
    results = []
    counter = 1
    with open(file_name) as file:
        for line in file:
            results.append(
            '''<div class="slide">
    <img
    decoding="async" loading="lazy" border="0"
    src="''' + line.strip() + '"'.strip() + f'''
    alt="Vendor {counter}"
    />
</div>
''')
            counter+=1
    return results





def get_datapoints_from_file(file_name):
    results = []
    counter = 1
    with open(file_name) as file:
        for line in file:
            results.append(
            '''<div class="slide">
    <img
    decoding="async" width="250px" height="150px" loading="lazy"
    src="''' + line.strip().rstrip(",") + f'''"
    alt="Vendor {counter}"
    />
</div>
'''.lstrip())
            counter+=1
    return results



#for scraping replacement URLS. Modify based on your website
def get_datapoints_from_website():

    my_replacements = []

    # Setup Chrome options (headless means no window pops up)
    options = webdriver.ChromeOptions()
    options.add_argument('--headless') 

    # Initialize the driver
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    
    try:
        url = "https://www.itprofessionalscommunity.org/lknitp"
        driver.get(url)
        
        # Wait a moment for JavaScript to load the content
        time.sleep(3) 

        # We target the parent container and look for the repeating pattern.
        # This relative path is much more robust than the absolute /html/body/... version.
        items_xpath = "//section[3]//div[contains(@class, 'div')]//a/div/div[2]/div/div/picture"
        items_xpath = "//picture"
        
        elements = driver.find_elements(By.XPATH, items_xpath)
        
        print(f"Found {len(elements)} items.\n")

        for index, element in enumerate(elements, start=1):
            # For <picture> tags, you usually want the 'src' from the nested <img> 
            # or the 'srcset' from the <source> tag.
            try:
                img_tag = element.find_element(By.TAG_NAME, "img")
                img_url = img_tag.get_attribute("src")
                my_replacements.append(f'src="{img_url}"')
                print(f"Item {index}: {img_url}")
            except:
                print(f"Item {index}: Could not find image source.")

    finally:
        driver.quit()
    return my_replacements

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




def replace_lines_with_array(file_path, pattern, replacement_values):

    """
    Finds lines matching a regex pattern and replaces them sequentially 
    with values from an array.
    """

    if replacement_values == []:
        print("replacement values is empty, exiting")
        sys.exit()

    
    temp_file = file_path + ".tmp"
    repl_index = 0
    num_replacements = len(replacement_values)

    try:
        with open(file_path, 'r') as f_in, open(temp_file, 'w') as f_out:
            for line in f_in:
                # Check if the line matches the pattern
                if re.search(pattern, line) and repl_index < num_replacements:
                    # Write the replacement value (adding a newline)
                    f_out.write(str(replacement_values[repl_index]) + '\n')
                    repl_index += 1
                else:
                    # Keep the original line
                    f_out.write(line)
        
        # Replace the original file with the modified temporary file
        os.replace(temp_file, file_path)
        print(f"Successfully updated {file_path}. Replaced {repl_index} lines.")

    except Exception as e:
        if os.path.exists(temp_file):
            os.remove(temp_file)
        print(f"An error occurred: {e}")

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
                        f_out.write(line)
                    else:
                        f_out.write(line)
                        
                if found_pattern is True:
                    if added_data is True:
                        f_out.write(line)
                    if added_data is False:
                    #iterate through data and adds after writing the previous match
                        for value in replacement_values:
                            f_out.write(value)
                        added_data = True

        # Replace the original file with the modified temporary file
        os.replace(temp_file, file_path)
        print(f"Successfully updated {file_path}. Replaced {repl_index} lines.")

    except Exception as e:
        if os.path.exists(temp_file):
            os.remove(temp_file)
        print(f"An error occurred: {e}")               
                        


                
    #iterate through data and add

# --- Example Usage ---
# Suppose 'data.txt' contains lines like: ID_PLACEHOLDER


perm_check(target_file_path)
my_replacements = get_datapoints_from_file("C:/Users/jackg/Downloads/wix_logos.txt")
print(my_replacements[0])
insert_lines_with_array(target_file_path, target_pattern, my_replacements)
