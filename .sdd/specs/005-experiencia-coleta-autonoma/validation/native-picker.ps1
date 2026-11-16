param([Parameter(Mandatory=$true)][string]$Profile,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$taskProfile=[System.IO.Path]::GetFullPath($Profile)
$taskDestination=[System.IO.Path]::GetFullPath($Destination)
if(-not $taskProfile.StartsWith([System.IO.Path]::GetTempPath()+'idealista005-fs-')){throw 'Perfil não pertence a este teste'}
if(-not (Test-Path -LiteralPath $taskDestination -PathType Container)){throw 'Pasta de teste não existe'}
$processes005=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($taskProfile)} | Select-Object -ExpandProperty ProcessId)
if(-not $processes005.Count){throw 'Chrome de teste não encontrado'}
$root005=[System.Windows.Automation.AutomationElement]::RootElement
$deadline005=(Get-Date).AddSeconds(30)
$dialog005=$null
while((Get-Date) -lt $deadline005 -and -not $dialog005){
 $windows005=$root005.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
 foreach($window005 in $windows005){if($processes005 -contains $window005.Current.ProcessId -and $window005.Current.ClassName -eq '#32770'){$dialog005=$window005;break}}
 if(-not $dialog005){Start-Sleep -Milliseconds 100}
}
if(-not $dialog005){throw 'Seletor nativo do Chrome temporário não encontrado'}
$edit005=$dialog005.FindFirst([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1148')))
if(-not $edit005){throw 'Campo de pasta nativo não encontrado'}
$value005=$edit005.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
$value005.SetValue($taskDestination)
$button005=$dialog005.FindFirst([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1')))
if(-not $button005){throw 'Botão de seleção nativo não encontrado'}
$button005.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
Write-Output 'Seletor nativo confirmado na pasta de teste'

