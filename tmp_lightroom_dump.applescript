on dumpElement(e, depth, maxDepth)
	if depth > maxDepth then return ""
	set indent to ""
	repeat depth times
		set indent to indent & "  "
	end repeat
	set lineText to indent
	try
		set lineText to lineText & (role of e as text)
	on error
		set lineText to lineText & "?"
	end try
	try
		set lineText to lineText & " | " & (subrole of e as text)
	end try
	try
		set lineText to lineText & " | name=" & (name of e as text)
	end try
	try
		set lineText to lineText & " | desc=" & (description of e as text)
	end try
	try
		set p to position of e
		set s to size of e
		set lineText to lineText & " | pos=" & (item 1 of p as text) & "," & (item 2 of p as text) & " size=" & (item 1 of s as text) & "x" & (item 2 of s as text)
	end try
	set resultText to lineText & linefeed
	try
		set kids to UI elements of e
		repeat with k in kids
			set nextDepth to depth + 1
			set resultText to resultText & (my dumpElement(k, nextDepth, maxDepth))
		end repeat
	end try
	return resultText
end dumpElement

tell application "System Events"
	tell process "Adobe Lightroom"
		set frontmost to true
		delay 0.2
		set targetWindow to window 1
		return my dumpElement(targetWindow, 0, 4)
	end tell
end tell
