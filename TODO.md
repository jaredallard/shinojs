# TODO

 * [ ] Implement Scopes for comamnds i.e "scope": "timeline" or "scope": "mentions"
 * [ ] Implement if statements i.e;

 ```json
 {
   "commands": [{
     "pattern": {
       "string": "stuff",
       "flag": "g"
     },
     "set": {
       "variable": "y",
       "value": true
     }
   },
   {
     "pattern": {
       "string":"do-stuff-if-stuff",
       "flag": "g"
     },
     "if": {
       "variable": "y",
       "is": true,
       "do": "function"
     }
   }]
 }
 ```

  * [ ] Implement more events, i.e tweet event. mention event. favorite event etc.
  * [ ] Implement opposite of one-shot events. type = on-event?
  * [ ] Along with if statements, implement set (as pictured above ^^^)

  ** pr to add stuff **
