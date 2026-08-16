#Requires -Version 5.1
<#
.SYNOPSIS
    Converts a LinkedIn personal data export (ZIP) into a Claude-ready Markdown file.

.DESCRIPTION
    LinkedIn allows every user to download their own data archive via:
      Settings & Privacy → Data Privacy → Get a copy of your data → Request archive
    The archive arrives as a ZIP containing CSV files for Profile, Positions,
    Education, Skills, Certifications, Languages, Projects, Honors, and more.

    This script:
      1. Extracts the ZIP to a temp folder
      2. Parses each relevant CSV
      3. Writes a single structured Markdown file optimised for Claude token efficiency

.NOTES
    No third-party modules required — uses only .NET / PowerShell built-ins.
    Tested on PowerShell 5.1 (Windows 11) and PowerShell 7+.

.EXAMPLE
    .\Convert-LinkedInExport.ps1
    # Uses paths defined in the CONFIGURATION block below.
#>

# ============================================================
#  CONFIGURATION  — edit these variables before running
# ============================================================

# Full path to the LinkedIn data export ZIP you downloaded
$LinkedInZipPath   = "$env:USERPROFILE\Downloads\Basic_LinkedInDataExport.zip"

# Directory where the output Markdown file will be written
$OutputDirectory   = "$env:USERPROFILE\Documents\LinkedInExport"

# Output file name (timestamp appended automatically)
$OutputFilePrefix  = "linkedin_profile"

# Temporary extraction directory (deleted on success unless $KeepTemp = $true)
$TempDirectory     = "$env:TEMP\linkedin_export_$([System.IO.Path]::GetRandomFileName())"

# Set to $true to keep the extracted CSV files after conversion
$KeepTemp          = $false

# ============================================================
#  INTERNAL HELPERS
# ============================================================

function Read-LinkedInCsv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @() }
    # LinkedIn CSVs sometimes have a note line before the header; skip lines
    # that don't look like a CSV row until we find the header.
    $lines = Get-Content -LiteralPath $Path -Encoding UTF8
    $startIndex = 0
    for ($i = 0; $i -lt [Math]::Min($lines.Count, 5); $i++) {
        if ($lines[$i] -match ',') { $startIndex = $i; break }
    }
    $csv = $lines[$startIndex..($lines.Count - 1)] | ConvertFrom-Csv
    return $csv
}

function Format-DateRange {
    param([string]$Start, [string]$End)
    $s = if ($Start) { $Start.Trim() } else { "" }
    $e = if ($End)   { $End.Trim()   } else { "Present" }
    if ($s -and $e) { return "$s – $e" }
    if ($s)         { return $s }
    return ""
}

function Sanitize-Md {
    param([string]$Text)
    if (-not $Text) { return "" }
    # Collapse whitespace, trim, remove stray pipe chars that break MD tables
    return $Text.Trim() -replace '\s+', ' ' -replace '\|', '-'
}

# ============================================================
#  MAIN
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Validate input -----------------------------------------------------------
if (-not (Test-Path -LiteralPath $LinkedInZipPath)) {
    Write-Error "LinkedIn ZIP not found at: $LinkedInZipPath`n" +
                "Download it from LinkedIn → Settings & Privacy → Data Privacy → Get a copy of your data."
    exit 1
}

# --- Prepare output directory -------------------------------------------------
if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}

# --- Extract ZIP --------------------------------------------------------------
Write-Host "Extracting archive..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($LinkedInZipPath, $TempDirectory)

# --- Locate CSVs (LinkedIn uses inconsistent capitalisation) ------------------
function Find-Csv { param([string]$Pattern)
    Get-ChildItem -LiteralPath $TempDirectory -Filter "*.csv" -Recurse |
        Where-Object { $_.Name -like $Pattern } |
        Select-Object -First 1 -ExpandProperty FullName
}

$csvProfile       = Find-Csv "Profile.csv"
$csvPositions     = Find-Csv "Positions.csv"
$csvEducation     = Find-Csv "Education.csv"
$csvSkills        = Find-Csv "Skills.csv"
$csvCerts         = Find-Csv "Certifications.csv"
$csvLanguages     = Find-Csv "Languages.csv"
$csvProjects      = Find-Csv "Projects.csv"
$csvHonors        = Find-Csv "Honors.csv"
$csvCourses       = Find-Csv "Courses.csv"
$csvVolunteer     = Find-Csv "Volunteer Causes Supported.csv"  # varies

# --- Parse --------------------------------------------------------------------
Write-Host "Parsing CSVs..."

$profile    = Read-LinkedInCsv $csvProfile    | Select-Object -First 1
$positions  = Read-LinkedInCsv $csvPositions
$education  = Read-LinkedInCsv $csvEducation
$skills     = Read-LinkedInCsv $csvSkills
$certs      = Read-LinkedInCsv $csvCerts
$languages  = Read-LinkedInCsv $csvLanguages
$projects   = Read-LinkedInCsv $csvProjects
$honors     = Read-LinkedInCsv $csvHonors
$courses    = Read-LinkedInCsv $csvCourses
$volunteer  = Read-LinkedInCsv $csvVolunteer

# --- Build Markdown -----------------------------------------------------------
Write-Host "Building Markdown..."
$sb = [System.Text.StringBuilder]::new()

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$null = $sb.AppendLine("<!-- LinkedIn profile export · generated $timestamp -->")
$null = $sb.AppendLine("")

# Header / contact
if ($profile) {
    $name    = Sanitize-Md "$($profile.'First Name') $($profile.'Last Name')"
    $headline = Sanitize-Md $profile.Headline
    $location = Sanitize-Md $profile.'Geo Location'
    $summary  = Sanitize-Md $profile.Summary
    $url      = Sanitize-Md $profile.'Public Profile Url'

    $null = $sb.AppendLine("# $name")
    if ($headline) { $null = $sb.AppendLine("**$headline**") }
    $contact = @()
    if ($location) { $contact += $location }
    if ($url)      { $contact += $url }
    if ($contact)  { $null = $sb.AppendLine($contact -join " · ") }
    $null = $sb.AppendLine("")

    if ($summary) {
        $null = $sb.AppendLine("## Summary")
        $null = $sb.AppendLine($summary)
        $null = $sb.AppendLine("")
    }
}

# Experience
if ($positions.Count -gt 0) {
    $null = $sb.AppendLine("## Experience")
    foreach ($p in $positions) {
        $title    = Sanitize-Md $p.'Title'
        $company  = Sanitize-Md $p.'Company Name'
        $range    = Format-DateRange $p.'Started On' $p.'Finished On'
        $loc      = Sanitize-Md $p.'Location'
        $desc     = Sanitize-Md $p.'Description'

        $null = $sb.AppendLine("### $title — $company")
        $meta = @()
        if ($range) { $meta += $range }
        if ($loc)   { $meta += $loc }
        if ($meta)  { $null = $sb.AppendLine($meta -join " · ") }
        if ($desc)  { $null = $sb.AppendLine($desc) }
        $null = $sb.AppendLine("")
    }
}

# Education
if ($education.Count -gt 0) {
    $null = $sb.AppendLine("## Education")
    foreach ($e in $education) {
        $school  = Sanitize-Md $e.'School Name'
        $degree  = Sanitize-Md $e.'Degree Name'
        $field   = Sanitize-Md $e.'Field Of Study'
        $range   = Format-DateRange $e.'Start Date' $e.'End Date'
        $grade   = Sanitize-Md $e.'Grade'
        $notes   = Sanitize-Md $e.'Notes'

        $heading = $school
        if ($degree -or $field) {
            $degStr = @($degree, $field) | Where-Object { $_ } | Join-String -Separator ", "
            $heading = "$school — $degStr"
        }
        $null = $sb.AppendLine("### $heading")
        if ($range) { $null = $sb.AppendLine($range) }
        if ($grade) { $null = $sb.AppendLine("Grade: $grade") }
        if ($notes) { $null = $sb.AppendLine($notes) }
        $null = $sb.AppendLine("")
    }
}

# Skills
if ($skills.Count -gt 0) {
    $null = $sb.AppendLine("## Skills")
    $skillList = ($skills | ForEach-Object { Sanitize-Md $_.Name }) -join ", "
    $null = $sb.AppendLine($skillList)
    $null = $sb.AppendLine("")
}

# Certifications
if ($certs.Count -gt 0) {
    $null = $sb.AppendLine("## Certifications")
    foreach ($c in $certs) {
        $name   = Sanitize-Md $c.Name
        $issuer = Sanitize-Md $c.Authority
        $issued = Sanitize-Md $c.'Started On'
        $expires= Sanitize-Md $c.'Finished On'
        $url    = Sanitize-Md $c.Url

        $line = "- **$name**"
        if ($issuer)  { $line += " · $issuer" }
        if ($issued)  { $line += " · Issued $issued" }
        if ($expires) { $line += " · Expires $expires" }
        if ($url)     { $line += " · $url" }
        $null = $sb.AppendLine($line)
    }
    $null = $sb.AppendLine("")
}

# Languages
if ($languages.Count -gt 0) {
    $null = $sb.AppendLine("## Languages")
    foreach ($l in $languages) {
        $lang        = Sanitize-Md $l.Name
        $proficiency = Sanitize-Md $l.Proficiency
        $entry = "- $lang"
        if ($proficiency) { $entry += " ($proficiency)" }
        $null = $sb.AppendLine($entry)
    }
    $null = $sb.AppendLine("")
}

# Projects
if ($projects.Count -gt 0) {
    $null = $sb.AppendLine("## Projects")
    foreach ($p in $projects) {
        $title = Sanitize-Md $p.Title
        $desc  = Sanitize-Md $p.Description
        $range = Format-DateRange $p.'Started On' $p.'Finished On'
        $url   = Sanitize-Md $p.Url

        $null = $sb.AppendLine("### $title")
        if ($range) { $null = $sb.AppendLine($range) }
        if ($desc)  { $null = $sb.AppendLine($desc) }
        if ($url)   { $null = $sb.AppendLine($url) }
        $null = $sb.AppendLine("")
    }
}

# Honors & Awards
if ($honors.Count -gt 0) {
    $null = $sb.AppendLine("## Honors & Awards")
    foreach ($h in $honors) {
        $title  = Sanitize-Md $h.Title
        $issuer = Sanitize-Md $h.Issuer
        $date   = Sanitize-Md $h.'Issued On'
        $desc   = Sanitize-Md $h.Description

        $line = "- **$title**"
        if ($issuer) { $line += " · $issuer" }
        if ($date)   { $line += " · $date" }
        $null = $sb.AppendLine($line)
        if ($desc)   { $null = $sb.AppendLine("  $desc") }
    }
    $null = $sb.AppendLine("")
}

# Courses
if ($courses.Count -gt 0) {
    $null = $sb.AppendLine("## Courses")
    foreach ($c in $courses) {
        $name   = Sanitize-Md $c.Name
        $number = Sanitize-Md $c.'Number'
        $entry  = "- $name"
        if ($number) { $entry += " ($number)" }
        $null = $sb.AppendLine($entry)
    }
    $null = $sb.AppendLine("")
}

# Volunteer
if ($volunteer.Count -gt 0) {
    $null = $sb.AppendLine("## Volunteer")
    foreach ($v in $volunteer) {
        # Column names vary; grab whatever looks like a cause/org
        $cause = Sanitize-Md ($v.'Cause' ?? $v.'Volunteer Cause' ?? ($v.PSObject.Properties | Select-Object -First 1).Value)
        if ($cause) { $null = $sb.AppendLine("- $cause") }
    }
    $null = $sb.AppendLine("")
}

# --- Write output file --------------------------------------------------------
$outFileName = "${OutputFilePrefix}_$(Get-Date -Format 'yyyyMMdd_HHmmss').md"
$outPath     = Join-Path $OutputDirectory $outFileName

$sb.ToString() | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Host "Output written to: $outPath"

# --- Cleanup ------------------------------------------------------------------
if (-not $KeepTemp) {
    Remove-Item -LiteralPath $TempDirectory -Recurse -Force
    Write-Host "Temp files removed."
} else {
    Write-Host "Temp files kept at: $TempDirectory"
}

Write-Host "Done."