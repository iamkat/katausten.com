. as $all
| .["@context"] as $context 
  | $context 
  | to_entries 
  | map(select(.value == {"@type": "@link"})) 
  | [ .[].key ] as $links 
| $all 
  | del(.["@context"]) 
  | to_entries 
  | map(select( [.key] as $keys 
              | $links 
              | contains($keys) 
              | not )) 
  | from_entries as $root 
| $all
  | del(.["@context"]) 
  | [ .. 
    | objects
    | to_entries
    | map(select( [.key] as $keys
                | $links 
                | contains($keys)))
    | reduce .[] as $item ( []
                          ; . + ( [ $item.value[] 
                                  | {"@type": $item.key } + . 
                                  ] ) )   
    ] | reduce .[] as $item ( [] 
                            ; . + $item )
      |  . as $nodes
| $nodes | [ .[]
  | to_entries 
  | map(select( [.key] as $keys 
              | $links 
              | contains($keys) 
              | not )) 
  | from_entries ] as $nodes 
| {} as $edges 
| { links: $links
  , nodes: ( [ $root ] + $nodes ) 
  , edges: $edges 
  }