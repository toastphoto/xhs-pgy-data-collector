[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
$desktop=[Windows.Automation.AutomationElement]::RootElement
$settings=$null
foreach($name in @('设置','Settings')) {
 $cond=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::NameProperty,$name)
 $settings=$desktop.FindFirst([Windows.Automation.TreeScope]::Children,$cond)
 if($settings){break}
}
if(-not $settings){throw 'DISPLAY_SETTINGS_WINDOW_MISSING'}
$cond=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::AutomationIdProperty,'SystemSettings_Display_Scaling_ItemSizeOverride_ComboBox')
$combo=$settings.FindFirst([Windows.Automation.TreeScope]::Descendants,$cond)
if(-not $combo -or -not $combo.Current.IsEnabled){throw 'SCALE_CONTROL_UNAVAILABLE'}
function GetScale {
 $sel=$combo.GetCurrentPattern([Windows.Automation.SelectionPattern]::Pattern)
 return @($sel.Current.GetSelection() | ForEach-Object {$_.Current.Name})
}
$before=GetScale
if($env:PGY_QA_TARGET_SCALE) {
 $target=$env:PGY_QA_TARGET_SCALE
 if($target -notin @('100','125','150')){throw 'UNAPPROVED_SCALE'}
 if(-not ($before | Where-Object {$_ -match ('^'+$target+'%')})) {
  $expand=$combo.GetCurrentPattern([Windows.Automation.ExpandCollapsePattern]::Pattern);$expand.Expand()
  Start-Sleep -Milliseconds 250
  $cond=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::ListItem)
  $items=$settings.FindAll([Windows.Automation.TreeScope]::Descendants,$cond)
  $matches=@($items | Where-Object {$_.Current.Name -match ('^'+$target+'%(?:\s|$)')})
  if($matches.Count -ne 1){throw 'SCALE_OPTION_NOT_UNIQUE'}
  $pick=$matches[0].GetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern);$pick.Select()
  Start-Sleep -Milliseconds 1200
 }
}
@{before=$before;after=(GetScale);changed=[bool]$env:PGY_QA_TARGET_SCALE;method='Windows Settings native UIAutomation';registryWritten=$false;logout=$false;reboot=$false} | ConvertTo-Json -Depth 4 -Compress
