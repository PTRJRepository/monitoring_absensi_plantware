SELECT 
    TRLN.[EmpCode],
    TRLN.[EmpName],
    TR.[DocDate],
    COUNT(*) AS RecordCount
FROM [db_ptrj].[dbo].[PR_TASKREGLN] AS TRLN
INNER JOIN [db_ptrj].[dbo].[PR_TASKREG] AS TR ON TR.[ID] = TRLN.[MasterID]
WHERE 
    TRLN.[OT] = '1' 
    AND MONTH(TR.[DocDate]) = 11
GROUP BY 
    TRLN.[EmpCode], 
    TRLN.[EmpName], 
    TR.[DocDate]
HAVING 
    COUNT(*) > 1
ORDER BY 
    TRLN.[EmpCode], 
    TR.[DocDate];